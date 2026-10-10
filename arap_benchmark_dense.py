import sys
from pathlib import Path
REPO_ROOT = Path(r'c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings')
sys.path.insert(0, str(REPO_ROOT))

import time
import numpy as np
import scipy.sparse.linalg as spla
import scipy.sparse as sp
import logging
logging.disable(logging.INFO)

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
        v2x = spla.spsolve(self.tA2xA2, self.tA2 @ b2[:, 0])
        v2y = spla.spsolve(self.tA2xA2, self.tA2 @ b2[:, 1])
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
        b2_top = np.column_stack((c * e0x + s * e0y, -s * e0x + c * e0y))
        b2 = np.vstack([b2_top, self.w * pins_xy])
        v2x = spla.spsolve(self.tA2xA2, self.tA2 @ b2[:, 0])
        v2y = spla.spsolve(self.tA2xA2, self.tA2 @ b2[:, 1])
        return np.vstack((v2x, v2y)).T

def main():
    from scipy.spatial import Delaunay
    print('Generating mock dense mesh (3000 vertices)...')
    np.random.seed(42)
    
    # Generate 3000 points uniformly in a square
    points = np.random.rand(3000, 2).astype(np.float32) * 500
    tri = Delaunay(points)
    triangles = tri.simplices.astype(np.int32)
    vertices = points
    
    # 16 standard AD joints
    joints = np.random.rand(16, 2).astype(np.float32) * 500
    
    print('Initializing ARAP (This takes a moment for dense meshes)...')
    arap = ARAP(joints, triangles, vertices)
    print(f'Vertices: {arap.A1.shape[1]//2}, Edges: {arap.edge_num}, Pins: {arap.pin_num}')
    
    bench = BenchmarkARAP(arap)
    
    frames = 80
    frame_pins = [joints + np.random.normal(0, 2, joints.shape).astype(np.float32) for _ in range(frames)]
    
    t1 = bench.solve_cpu_original(frame_pins[0])
    t2 = bench.solve_cpu_vectorized(frame_pins[0])
    print(f'Max Error (CPU Orig vs CPU Vect): {np.max(np.abs(t1 - t2)):.8e}')
    
    print('\n--- BENCHMARK 80 FRAMES (DENSE MESH) ---')
    t0 = time.time()
    for pins in frame_pins:
        bench.solve_cpu_original(pins)
    print(f'CPU Original: {time.time() - t0:.3f}s')
    
    t0 = time.time()
    for pins in frame_pins:
        bench.solve_cpu_vectorized(pins)
    print(f'CPU Vectorized: {time.time() - t0:.3f}s')

if __name__ == '__main__':
    main()
