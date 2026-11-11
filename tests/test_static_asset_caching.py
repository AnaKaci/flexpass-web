"""Static assets can be cached without caching private API responses."""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.app import CachedStaticFiles


def test_versioned_static_assets_get_immutable_cache_headers(tmp_path):
    (tmp_path / 'index-abcdefgh.js').write_text('console.log("FlexPass")')
    web = FastAPI()
    web.mount('/assets', CachedStaticFiles(
        directory=tmp_path,
        cache_control='public, max-age=31536000, immutable',
    ))
    response = TestClient(web).get('/assets/index-abcdefgh.js')
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'public, max-age=31536000, immutable'


def test_non_versioned_brand_files_have_short_cache(tmp_path):
    (tmp_path / 'logo.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
    web = FastAPI()
    web.mount('/brand', CachedStaticFiles(
        directory=tmp_path,
        cache_control='public, max-age=3600',
    ))
    response = TestClient(web).get('/brand/logo.svg')
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'public, max-age=3600'
