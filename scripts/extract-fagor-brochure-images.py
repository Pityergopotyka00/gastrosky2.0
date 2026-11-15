#!/usr/bin/env python3
"""Extract only model-matched Fagor 2026 product photos from Fagor's own public brochure.

Runs in GitHub Actions where HTTPS is enabled. Never maps the same generic
cooker photo to unrelated product SKUs. An unresolved image stays unresolved.
"""
from __future__ import annotations
import io
import json
import math
import os
import re
import urllib.request
from pathlib import Path
import fitz
from PIL import Image, ImageOps

CATALOG = Path("data/catalog-products.json")
HTML = Path("index.html")
OUTPUT = Path("public/media/official-fagor-2026")
REPORT = Path("data/fagor-brochure-photo-report.json")
BROCHURE = "https://www.fagorprofessional.com/documents/d/global/fp-folleto-novelties_2026_v07_en_sp"
# Indices refer to PDF pages (the printed page numbers are one higher).
MODELS = {
    "19114234": ("CI-MW2", 4, "Mikrohullámú sütő"),
    "19115446": ("CD-CIE604 2", 5, "Indukciós főzőlap"),
    "19115443": ("CD-FTE604 1", 5, "Indukciós sütőlap"),
    "19115444": ("CD-FTE608 1", 5, "Indukciós sütőlap"),
    "19115445": ("CD-CPE604 15", 6, "Indukciós tésztafőző"),
    "19115442": ("CD-FE604 10", 6, "Indukciós olajsütő"),
    "19114901": ("CI-I40 1", 7, "Indukciós főzőlap"),
    "19114903": ("CI-I45 2", 7, "Dupla indukciós főzőlap"),
    "19114904": ("CI-M60 1", 8, "Üvegfelületű ételmelegítő"),
}
# Image rectangles verified against the actual official PDF page layout.
# Some PDF products have multiple overlaid raster layers; use source geometry,
# not a naive nearest-label test.
MODEL_PHOTO_RECTS = {
    "19114234": (207.9, 137.7, 399.2, 269.6),
    "19115446": (55.9, 138.2, 217.9, 253.6),
    "19115443": (56.7, 504.4, 218.6, 614.7),
    "19115444": (56.7, 504.4, 218.6, 614.7),
    "19115445": (59.6, 128.0, 207.1, 247.2),
    "19115442": (52.4, 483.8, 210.2, 613.3),
    "19114901": (58.0, 151.8, 287.1, 265.3),
    "19114903": (283.0, 133.9, 523.4, 283.5),
    "19114904": (169.7, 141.9, 415.4, 294.9),
}
# The manufacturer's brochure itself uses one photograph for these two
# fry-top size variants; retain that relationship in internal source metadata.
FAMILY_PHOTO_SKUS = frozenset(("19115443", "19115444"))

def download():
    request = urllib.request.Request(
        BROCHURE, headers={"User-Agent": "GastroSkyProductCatalog/1.0", "Accept": "application/pdf"}
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read(170_000_001)
    print("Downloaded brochure bytes:", len(data), "signature:", repr(data[:12]))
    if not data.startswith(b"%PDF") or len(data) > 170_000_000:
        raise RuntimeError("Official brochure is not a valid PDF or exceeds 170 MB")
    return data

def centers(rect):
    return ((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2)

def photo_blocks(page):
    # The manufacturer PDF may contain multiple independent photographic blocks.
    blocks = [fitz.Rect(block["bbox"]) for block in page.get_text("dict")["blocks"] if block.get("type") == 1]
    for image in page.get_images(full=True):
        try:
            blocks.extend(page.get_image_rects(image[0]))
        except Exception:
            pass
    found = {}
    for rect in blocks:
        area = rect.width * rect.height
        if rect.width < 75 or rect.height < 65 or area < 7000:
            continue
        if area > page.rect.width * page.rect.height * 0.57:
            continue
        if not (0.35 <= rect.width / rect.height <= 3.3):
            continue
        found[tuple(round(v, 1) for v in rect)] = rect
    return list(found.values())

def match_image(page, name, sku):
    # Validate SKU-specific model text is printed on this official source page.
    if not page.search_for(name):
        return None, "model_label_missing"
    expected = fitz.Rect(MODEL_PHOTO_RECTS[sku])
    candidates = photo_blocks(page)
    if not candidates:
        return None, "page_has_no_separate_product_photo"
    # Compare image rectangles, de-duplicating overlapping raster layers.
    best = min(candidates, key=lambda r: sum(abs(x-y) for x,y in zip(r, expected)))
    mismatch = max(abs(x-y) for x,y in zip(best, expected))
    if mismatch > 5.0:
        return None, "manufacturer_photo_position_changed"
    return best, ("official_shared_variant_photo" if sku in FAMILY_PHOTO_SKUS else "official_model_photo_position")

def export(page, rect, path):
    # Crop to the product's own raster image bounding box.
    pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), clip=rect, alpha=False)
    im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    im.thumbnail((950, 950), Image.Resampling.LANCZOS)
    im.save(path, "WEBP", quality=88, method=6)

def main():
    products = json.loads(CATALOG.read_text(encoding="utf-8"))
    pdf = fitz.open(stream=download(), filetype="pdf")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {"official_brochure": BROCHURE, "matched": [], "unresolved": []}
    generated = {}
    for sku, (model, page_index, category) in MODELS.items():
        item = next((p for p in products if p.get("manufacturer") == "Fagor" and str(p.get("sku")) == sku), None)
        if item is None:
            report["unresolved"].append({"sku": sku, "reason": "not_in_catalog"})
            continue
        page = pdf[page_index]
        rectangle, status = match_image(page, model, sku)
        if rectangle is None:
            report["unresolved"].append({"sku": sku, "model": model, "reason": status})
            continue
        filename = sku + ".webp"
        export(page, rectangle, OUTPUT / filename)
        generated[sku] = "/media/official-fagor-2026/" + filename
        report["matched"].append({"sku": sku, "model": model, "type": category, "page": page_index + 1, "image": generated[sku]})
    # Two different SKUs must never silently receive identical photograph bytes.
    # Reject every member of a duplicate set until model/photo positions are reviewed.
    import hashlib
    grouped = {}
    for sku in generated:
        digest = hashlib.sha256((OUTPUT / (sku + ".webp")).read_bytes()).hexdigest()
        grouped.setdefault(digest, []).append(sku)
    for same_photo_skus in grouped.values():
        if len(same_photo_skus) < 2:
            continue
        if set(same_photo_skus) == FAMILY_PHOTO_SKUS:
            continue  # manufacturer prints the same photo for both size variants
        for sku in same_photo_skus:
            (OUTPUT / (sku + ".webp")).unlink(missing_ok=True)
            generated.pop(sku, None)
            report["matched"] = [m for m in report["matched"] if m["sku"] != sku]
            report["unresolved"].append({"sku": sku, "reason": "duplicate_photo_same_bytes_as_another_model"})
    # Undo any previously published duplicate photos from this exact script.
    for product in products:
        sku = str(product.get("sku"))
        if (product.get("manufacturer") == "Fagor"
                and product.get("image_source") in ("official_fagor_brochure_model_nearby_photo", "official_fagor_brochure_shared_variant_photo")
                and sku not in generated):
            product["image_url"] = None
            product["image_source"] = "unverified_no_model_photo"
            product["photo_status"] = "model_photo_not_verified"
    # Photos that could be the same shared PDF block for multiple variants are
    # not safe to label as exact-model, unless the PDF explicitly shows both.
    for sku, url in generated.items():
        item = next(p for p in products if p.get("manufacturer") == "Fagor" and str(p.get("sku")) == sku)
        if item.get("image_url") and item.get("image_source", "").startswith("official_"):
            continue
        item["image_url"] = url
        item["image_source"] = ("official_fagor_brochure_shared_variant_photo" if sku in FAMILY_PHOTO_SKUS else "official_fagor_brochure_model_nearby_photo")
        item["photo_status"] = "manufacturer_brochure_photo_needs_visual_review"
    changed = {p["sku"] for p in products if p.get("manufacturer") == "Fagor" and str(p.get("sku")) in generated}
    if generated:
        CATALOG.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        html = HTML.read_text(encoding="utf-8")
        start = html.find("let products=")
        end = html.find(";\nconst categoryGroup=", start)
        if start < 0 or end < 0:
            raise RuntimeError("Embedded catalog not found")
        html = html[:start] + "let products=" + json.dumps(products, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + html[end:]
        HTML.write_text(html, encoding="utf-8")
    report["count"] = len(report["matched"])
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"new_image_assets": len(generated), "unresolved": report["unresolved"]}, ensure_ascii=False))
    if not generated:
        raise RuntimeError("No photographs could be confidently extracted; leave existing fallback intact")
if __name__ == "__main__":
    main()
