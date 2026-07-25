# Chapter 2: The Dataset & Coordinate System Alignment

A major engineering challenge in this project was mapping original dataset annotations to the image files provided on disk. In this chapter, we explore the math behind coordinate transformations, the alignment bug we encountered, and how we solved it.

---

## 1. The Alignment Mismatch

Meta's **Amateur Drawings Dataset (ADD)** consists of two parts:
1. **`amateur_drawings_annotations.json`**: Contains coordinates relative to the original high-resolution photo taken by the parent (e.g. $1425 \times 1900$ pixels).
2. **`amateur_drawings.tar`**: Contains drawings that have already been **cropped** to the character's bounding box and **downscaled** to a maximum size of 512 pixels (e.g. $384 \times 512$).

If you try to map the raw coordinates in the JSON file directly to the images on disk, the skeletons will be plotted far outside the character body—often appearing tiny and offset in the top-left corner of the blank space.

---

## 2. Mathematical Coordinate Mapping

To correctly map a point $(x_{\text{orig}}, y_{\text{orig}})$ from the high-resolution photo to its corresponding coordinate $(x_{\text{final}}, y_{\text{final}})$ on the cropped, downscaled image, we must perform a two-step transformation:

```
[Original High-Res Photo]
   └── (x_orig, y_orig)
          │
          ▼  Step 1: Subtract Bounding Box Offset [left, top]
[Cropped Coordinate Space]
   └── (x_cropped, y_cropped)
          │
          ▼  Step 2: Scale by Disk-to-Bbox ratio [w_disk/w_bbox, h_disk/h_bbox]
[Final Image on Disk]
   └── (x_final, y_final)
```

### Step 1: Translate to Cropped Space
Subtract the bounding box offset `(left, top)` to shift the origin $(0,0)$ to the top-left corner of the character's bounding box:

$$x_{\text{cropped}} = x_{\text{orig}} - \text{left}$$
$$y_{\text{cropped}} = y_{\text{orig}} - \text{top}$$

### Step 2: Scale to Actual Dimensions on Disk
Multiply by the ratio between the actual image dimensions on disk $(w_{\text{disk}}, h_{\text{disk}})$ and the original bounding box dimensions $(w_{\text{bbox}}, h_{\text{bbox}})$:

$$x_{\text{final}} = x_{\text{cropped}} \times \left( \frac{w_{\text{disk}}}{w_{\text{bbox}}} \right) = (x_{\text{orig}} - \text{left}) \times \frac{w_{\text{disk}}}{w_{\text{bbox}}}$$

$$y_{\text{final}} = y_{\text{cropped}} \times \left( \frac{h_{\text{disk}}}{h_{\text{bbox}}} \right) = (y_{\text{orig}} - \text{top}) \times \frac{h_{\text{disk}}}{h_{\text{bbox}}}$$

---

## 3. Normalization for YOLO Format

YOLOv8-Pose expects bounding boxes and keypoints to be **normalized** between $0.0$ and $1.0$ (relative to the dimensions of the image loaded by YOLO). 

To normalize the keypoints in the cropped image space, we divide the final pixel coordinates by the actual disk dimensions:

$$x_{\text{norm}} = \frac{x_{\text{final}}}{w_{\text{disk}}} = \frac{(x_{\text{orig}} - \text{left}) \times \frac{w_{\text{disk}}}{w_{\text{bbox}}}}{w_{\text{disk}}}$$

Simplifying this equation reveals an elegant result: the disk dimensions $w_{\text{disk}}$ and $h_{\text{disk}}$ cancel out completely!

$$x_{\text{norm}} = \frac{x_{\text{orig}} - \text{left}}{w_{\text{bbox}}}$$

$$y_{\text{norm}} = \frac{y_{\text{orig}} - \text{top}}{h_{\text{bbox}}}$$

#### Bounding Box in YOLO Space:
Since the image on disk is *already* cropped to the character's bounding box, the character spans the **entire image**. In YOLO format, the normalized bounding box is centered at the middle of the image, occupying 100% of the space:
* **Center X ($x_c$):** `0.5`
* **Center Y ($y_c$):** `0.5`
* **Width ($w$):** `1.0`
* **Height ($h$):** `1.0`

Applying these transformations ensures the dataset labels align perfectly with the sketch drawings.
