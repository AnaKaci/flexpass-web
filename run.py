"""Local FastAPI server. Hosted Docker deployment uses uvicorn directly."""
import os
import uvicorn

if __name__ == '__main__':
    uvicorn.run(
        'backend.app:app',
        host=os.environ.get('HOST', '127.0.0.1'),
        port=int(os.environ.get('PORT', '8000')),
        reload=False,
    )
