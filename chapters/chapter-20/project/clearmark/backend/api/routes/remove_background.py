"""
Remove Background API routes
使用 rembg 库移除图片背景
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from rembg import remove
from PIL import Image
import io

router = APIRouter()


@router.post("/api/v1/remove-background")
async def remove_background(file: UploadFile = File(...)):
    """
    移除图片背景
    
    Args:
        file: 上传的图片文件
        
    Returns:
        处理后的图片（PNG 格式，透明背景）
    """
    try:
        # 验证文件类型
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Please upload an image file."
            )
        
        # 读取上传的文件
        input_image = await file.read()
        
        # 验证文件大小（最大 10MB）
        if len(input_image) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 10MB."
            )
        
        # 使用 rembg 移除背景
        output_image = remove(input_image)
        
        # 处理文件名编码问题（支持中文文件名）
        import urllib.parse
        original_filename = file.filename or 'image'
        # 移除扩展名并添加新扩展名
        if '.' in original_filename:
            name_without_ext = original_filename.rsplit('.', 1)[0]
        else:
            name_without_ext = original_filename
        
        # 使用 URL 编码处理文件名，避免 latin-1 编码错误
        safe_filename = f"removed_background_{name_without_ext}.png"
        encoded_filename = urllib.parse.quote(safe_filename.encode('utf-8'))
        
        # 返回处理后的图片
        return Response(
            content=output_image,
            media_type="image/png",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove background: {str(e)}"
        )


@router.get("/api/v1/remove-background/health")
async def remove_background_health():
    """检查 remove background 服务状态"""
    try:
        # 简单的健康检查，测试 rembg 是否可以导入
        from rembg import remove
        return {
            "status": "ok",
            "service": "remove-background",
            "rembg_available": True
        }
    except Exception as e:
        return {
            "status": "error",
            "service": "remove-background",
            "rembg_available": False,
            "error": str(e)
        }

