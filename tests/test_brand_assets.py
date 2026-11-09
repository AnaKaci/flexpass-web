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

def test_official_vector_assets_are_present_and_safe():
    """The supplied paths are included as source assets, not recreated by CSS text."""
    brand = ROOT / 'frontend' / 'public' / 'brand'
    names = [
        'flexpass-full-original.svg', 'flexpass-monogram-original.svg',
        'flexpass-full.svg', 'flexpass-monogram.svg',
        'flexpass-full-ivory.svg', 'flexpass-monogram-ivory.svg',
    ]
    for name in names:
        file = brand / name
        assert file.is_file(), f'Missing official brand artwork: {name}'
        contents = file.read_text(encoding='utf-8')
        assert contents.startswith('<svg')
        assert '<path ' in contents
        assert '<script' not in contents.lower()
        assert '<foreignobject' not in contents.lower()
    assert 'fill="#074653"' in (brand/'flexpass-full-original.svg').read_text()
    assert 'fill="#F5EFE4"' in (brand/'flexpass-full-ivory.svg').read_text()

def test_compiled_logos_are_served_on_render_when_dist_exists():
    if not (DIST/'brand').is_dir():
        return
    client = TestClient(app)
    for name in ('flexpass-full.svg','flexpass-monogram.svg',
                 'flexpass-full-ivory.svg','flexpass-monogram-ivory.svg'):
        response = client.get('/brand/'+name)
        assert response.status_code == 200
        assert response.content.startswith(b'<svg')
        assert 'image/svg+xml' in response.headers['content-type']
