"""
Chunked downloader for Meta Amateur Drawings Dataset annotations.json with progress display.
"""
import os
import requests
import json
from pathlib import Path

DATASET_ROOT = Path(__file__).parent.parent / "datasets" / "sketch_humanoids"
ANNOTATIONS_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings_annotations.json"

def download_annotations():
    DATASET_ROOT.mkdir(parents=True, exist_ok=True)
    json_path = DATASET_ROOT / "annotations.json"
    
    print(f"[*] Connecting to Meta public files server:\n    {ANNOTATIONS_URL}")
    response = requests.get(ANNOTATIONS_URL, stream=True)
    response.raise_for_status()

    total_length = response.headers.get('content-length')
    total_bytes = int(total_length) if total_length else 0

    print(f"[*] File Size: {total_bytes / (1024*1024):.2f} MB")
    print("[*] Starting chunked download...")

    downloaded = 0
    with open(json_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=1024*1024): # 1 MB chunks
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_bytes > 0:
                    percent = (downloaded / total_bytes) * 100
                    print(f"    Progress: {downloaded / (1024*1024):.1f} / {total_bytes / (1024*1024):.1f} MB ({percent:.1f}%)")
                else:
                    print(f"    Downloaded: {downloaded / (1024*1024):.1f} MB")

    print("\n[SUCCESS] Download completed successfully!")
    
    # Verify JSON structure
    print("[*] Verifying JSON structure...")
    with open(json_path, 'r') as f:
        data = json.load(f)

    images = data.get('images', [])
    annotations = data.get('annotations', [])
    categories = data.get('categories', [])

    print("=" * 60)
    print("  META AMATEUR DRAWINGS DATASET (ADD) SUMMARY")
    print("=" * 60)
    print(f"Total Images:      {len(images):,}")
    print(f"Total Annotations: {len(annotations):,}")
    print(f"Categories:        {[c['name'] for c in categories]}")
    
    if len(annotations) > 0:
        sample_ann = annotations[0]
        print(f"\nSample Annotation Structure:")
        print(f"  Image ID:   {sample_ann.get('image_id')}")
        print(f"  BBox:       {sample_ann.get('bbox')} [x, y, width, height]")
        print(f"  Keypoints:  {len(sample_ann.get('keypoints', []))} values (17 joints x [x, y, visibility])")

if __name__ == '__main__':
    download_annotations()
