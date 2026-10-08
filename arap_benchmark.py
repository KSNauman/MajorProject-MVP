import sys
from pathlib import Path
REPO_ROOT = Path(r'c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings')
sys.path.insert(0, str(REPO_ROOT))

import time
import numpy as np
import scipy.sparse.linalg as spla
import scipy.sparse as sp
import logging

try:
    import cupy as cp
    import cupyx.scipy.sparse as csp
    import cupyx.scipy.sparse.linalg as cspla
    CUPY_AVAILABLE = True
except ImportError:
    CUPY_AVAILABLE = False
    print('CuPy not found. Make sure cupy is installed.')

from animated_drawings.model.arap import ARAP

class BenchmarkARAP:
    def __init__(self, original_arap):
        self.w = original_arap.w
        self.pin_num = original_arap.pin_num
        self.edge_num = original_arap.edge_num
        self.pin_mask = original_arap.pin_mask
        self.edge_vectors = original_arap.edge_vectors
        
        self.tA1xA1 = original_arap.tA1xA1
        self.tA1 = original_arap.tA1
        self.tA2xA2 = original_arap.tA2xA2
        self.tA2 = original_arap.tA2
        self.G = original_arap.G

        if CUPY_AVAILABLE:
            try:
                self.c_tA1xA1 = csp.csr_matrix(self.tA1xA1)
                self.c_tA1 = csp.csr_matrix(self.tA1)
                self.c_tA2xA2 = csp.csr_matrix(self.tA2xA2)
                self.c_tA2 = csp.csr_matrix(self.tA2)
                self.c_G = csp.csr_matrix(self.G)
                self.c_edge_vectors = cp.asarray(self.edge_vectors)
                self.cupy_init_success = True
            except Exception as e:
                print('CuPy initialization failed:', e)
                self.cupy_init_success = False

    def solve_cpu_original(self, pins_xy_):
        pins_xy = pins_xy_[self.pin_mask]
        b1 = np.hstack([np.zeros([2 * self.edge_num], dtype=np.float64), self.w * pins_xy.reshape([-1, ])])
        v1 = spla.spsolve(self.tA1xA1, self.tA1 @ b1.T)
        
        T1 = self.G @ v1
        b2_top = np.empty([self.edge_num, 2], dtype=np.float64)
        
        for idx, e0 in enumerate(self.edge_vectors):
            c = T1[2*idx]
            s = T1[2*idx + 1]
            scale = 1.0 / np.sqrt(c * c + s * s)
            c *= scale
            s *= scale
            T2 = np.asarray(((c, s), (-s, c)))
            e1 = np.dot(T2, e0)
            b2_top[idx] = e1
            
        b2 = np.vstack([b2_top, self.w * pins_xy])
        b2x = b2[:, 0]
        b2y = b2[:, 1]
        v2x = spla.spsolve(self.tA2xA2, self.tA2 @ b2x)
        v2y = spla.spsolve(self.tA2xA2, self.tA2 @ b2y)
        return np.vstack((v2x, v2y)).T

    def solve_cpu_vectorized(self, pins_xy_):
        pins_xy = pins_xy_[self.pin_mask]
        b1 = np.hstack([np.zeros([2 * self.edge_num], dtype=np.float64), self.w * pins_xy.reshape([-1, ])])
        v1 = spla.spsolve(self.tA1xA1, self.tA1 @ b1.T)
        
        T1 = self.G @ v1
        
        c = T1[0::2]
        s = T1[1::2]
        scale = 1.0 / np.sqrt(c*c + s*s)
        c *= scale
        s *= scale
        
        e0x = self.edge_vectors[:, 0]
        e0y = self.edge_vectors[:, 1]
        
        b2_top_x = c * e0x + s * e0y
        b2_top_y = -s * e0x + c * e0y
        b2_top = np.column_stack((b2_top_x, b2_top_y))
        
        b2 = np.vstack([b2_top, self.w * pins_xy])
        b2x = b2[:, 0]
        b2y = b2[:, 1]
        v2x = spla.spsolve(self.tA2xA2, self.tA2 @ b2x)
        v2y = spla.spsolve(self.tA2xA2, self.tA2 @ b2y)
        return np.vstack((v2x, v2y)).T

    def solve_gpu_vectorized(self, pins_xy_):
        if not CUPY_AVAILABLE or not self.cupy_init_success: return None
        
        t_transfer_start = time.perf_counter()
        c_pins_xy_ = cp.asarray(pins_xy_)
        c_pins_xy = c_pins_xy_[self.pin_mask]
        
        c_b1 = cp.hstack([cp.zeros([2 * self.edge_num], dtype=cp.float64), self.w * c_pins_xy.reshape([-1, ])])
        t_transfer = time.perf_counter() - t_transfer_start
        
        t_solve1_start = time.perf_counter()
        c_v1 = cspla.spsolve(self.c_tA1xA1, self.c_tA1 @ c_b1.T)
        t_solve1 = time.perf_counter() - t_solve1_start
        
        t_rot_start = time.perf_counter()
        c_T1 = self.c_G @ c_v1
        
        c = c_T1[0::2]
        s = c_T1[1::2]
        scale = 1.0 / cp.sqrt(c*c + s*s)
        c *= scale
        s *= scale
        
        e0x = self.c_edge_vectors[:, 0]
        e0y = self.c_edge_vectors[:, 1]
        
        b2_top_x = c * e0x + s * e0y
        b2_top_y = -s * e0x + c * e0y
        b2_top = cp.column_stack((b2_top_x, b2_top_y))
        
        c_b2 = cp.vstack([b2_top, self.w * c_pins_xy])
        b2x = c_b2[:, 0]
        b2y = c_b2[:, 1]
        t_rot = time.perf_counter() - t_rot_start
        
        t_solve2_start = time.perf_counter()
        c_v2x = cspla.spsolve(self.c_tA2xA2, self.c_tA2 @ b2x)
        c_v2y = cspla.spsolve(self.c_tA2xA2, self.c_tA2 @ b2y)
        res = cp.vstack((c_v2x, c_v2y)).T
        t_solve2 = time.perf_counter() - t_solve2_start
        
        t_transfer_out_start = time.perf_counter()
        final_res = res.get()
        t_transfer += time.perf_counter() - t_transfer_out_start
        
        return final_res, t_transfer, t_solve1 + t_solve2, t_rot

def main():
    import yaml
    import glob
    import cv2
    from scipy.spatial import Delaunay
    
    char_cfgs = glob.glob(r'c:\Major Project - MVP2\Major Project - MVP\eduvision_ui\uploads\char_data_*\char_cfg.yaml')
    if not char_cfgs:
        print('No char_cfg found.')
        return
    cfg_path = char_cfgs[-1]
    
    with open(cfg_path, 'r') as f:
        char_cfg = yaml.safe_load(f)
    mask_path = cfg_path.replace('char_cfg.yaml', 'mask.png')
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    poly = max(contours, key=cv2.contourArea).reshape(-1, 2)
    epsilon = 0.005 * cv2.arcLength(poly, True)
    points = cv2.approxPolyDP(poly, epsilon, True).reshape(-1, 2).astype(np.float32)
    tri = Delaunay(points)
    triangles = tri.simplices.astype(np.int32)
    vertices = points
    
    joints = np.array([j['loc'] for j in char_cfg['skeleton']], dtype=np.float32)
    
    logging.disable(logging.INFO)
    arap = ARAP(joints, triangles, vertices)
    bench = BenchmarkARAP(arap)
    
    frames = 80
    np.random.seed(42)
    frame_pins = [joints + np.random.normal(0, 2, joints.shape).astype(np.float32) for _ in range(frames)]
    
    print('--- EQUIVALENCE TEST ---')
    t1 = bench.solve_cpu_original(frame_pins[0])
    t2 = bench.solve_cpu_vectorized(frame_pins[0])
    print(f'Max Error (CPU Orig vs CPU Vect): {np.max(np.abs(t1 - t2)):.8e}')
    
    if CUPY_AVAILABLE and bench.cupy_init_success:
        try:
            t3, _, _, _ = bench.solve_gpu_vectorized(frame_pins[0])
            print(f'Max Error (CPU Orig vs GPU Vect): {np.max(np.abs(t1 - t3)):.8e}')
        except Exception as e:
            print(f'GPU Error: {e}')
            
    print('\n--- BENCHMARK 80 FRAMES ---')
    t0 = time.time()
    for pins in frame_pins:
        bench.solve_cpu_original(pins)
    orig_time = time.time() - t0
    print(f'CPU Original: {orig_time:.3f}s')
    
    t0 = time.time()
    for pins in frame_pins:
        bench.solve_cpu_vectorized(pins)
    vect_time = time.time() - t0
    print(f'CPU Vectorized: {vect_time:.3f}s')
    
    if CUPY_AVAILABLE and bench.cupy_init_success:
        t0 = time.time()
        transfer_total = 0
        solve_total = 0
        rot_total = 0
        success = True
        for pins in frame_pins:
            try:
                _, tt, ts, tr = bench.solve_gpu_vectorized(pins)
                transfer_total += tt
                solve_total += ts
                rot_total += tr
            except Exception as e:
                print(f'GPU Solve Failed during loop: {e}')
                success = False
                break
        gpu_time = time.time() - t0
        if success:
            print(f'GPU Vectorized: {gpu_time:.3f}s')
            print(f'  - Transfers: {transfer_total:.3f}s')
            print(f'  - Sparse Solves: {solve_total:.3f}s')
            print(f'  - Rotation Math: {rot_total:.3f}s')

if __name__ == '__main__':
    main()
