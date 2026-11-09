"""Regression checks for public photography shipped to the Render frontend."""
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app import app, DIST, ROOT

def test_arch_photo_is_valid_jpeg_in_source_tree():
    photo=ROOT/'frontend'/'public'/'brand'/'arch-view.jpg'
    assert photo.is_file(), "Brand arch photograph is missing from frontend/public"
    raw=photo.read_bytes()
    assert len(raw)>3000
    assert raw[:3]==b'\xff\xd8\xff', "Hero image should be a JPEG"
    assert raw[-2:]==b'\xff\xd9', "Hero JPEG is truncated"

def test_compiled_brand_photo_is_served_when_dist_exists():
    # A production Docker build includes dist/brand; Python-only CI does not build Vite.
    if not (DIST/'brand').is_dir():
        return
    response=TestClient(app).get('/brand/arch-view.jpg')
    assert response.status_code==200,response.text
    assert response.headers['content-type'].startswith('image/jpeg')
    assert response.content[:3]==b'\xff\xd8\xff'
