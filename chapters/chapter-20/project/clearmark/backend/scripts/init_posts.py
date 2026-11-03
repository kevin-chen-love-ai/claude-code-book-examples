"""
Initialize blog posts in the database
"""
import sys
import os
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Try different import paths
try:
    from backend.db.connection import SessionLocal
    from backend.models.post import Post
    from backend.models.profile import Profile
except ImportError:
    try:
        from db.connection import SessionLocal
        from models.post import Post
        from models.profile import Profile
    except ImportError:
        # Add backend directory to path if needed
        backend_dir = os.path.join(os.path.dirname(current_dir), 'backend')
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        from db.connection import SessionLocal
        from models.post import Post
        from models.profile import Profile

# Sample posts data based on current static content
SAMPLE_POSTS = [
    {
        "title": "Deep Learning Applications in Image Inpainting",
        "slug": "deep-learning-applications-in-image-inpainting",
        "tags": ["Deep Learning", "GAN", "Technology"],
        "featured_image": "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=800&h=400&fit=crop&q=80",
        "content": """# Deep Learning Applications in Image Inpainting

Image inpainting is a computer vision technique used to reconstruct missing or corrupted parts of images. With the advancement of deep learning, particularly Generative Adversarial Networks (GANs), we can now achieve remarkable results in image restoration.

## What is Image Inpainting?

Image inpainting involves filling in missing regions of an image with visually plausible content. Traditional methods relied on interpolation and texture synthesis, but modern deep learning approaches can generate more realistic results.

## Deep Learning Approaches

### 1. GANs for Image Inpainting

Generative Adversarial Networks have revolutionized image inpainting. They consist of:
- **Generator**: Creates the inpainted content
- **Discriminator**: Evaluates the realism of the generated content

### 2. Attention Mechanisms

Attention mechanisms help the model focus on relevant parts of the image when generating the missing regions.

## Applications

- **Watermark Removal**: Remove unwanted watermarks from images
- **Object Removal**: Remove unwanted objects from photos
- **Image Restoration**: Restore damaged historical photos
- **Photo Editing**: Professional photo editing workflows

## Conclusion

Deep learning has made image inpainting more accessible and effective than ever before. As models continue to improve, we can expect even better results in the future.""",
        "published": True
    },
    {
        "title": "ClearMark API 2.0 Released",
        "slug": "clearmark-api-2-0-released",
        "tags": ["Product Update", "API"],
        "featured_image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop&q=80",
        "content": """# ClearMark API 2.0 Released

We're excited to announce the release of ClearMark API 2.0, bringing significant improvements in processing speed, accuracy, and developer experience.

## What's New

### Enhanced Processing Speed

The new API architecture delivers up to 3x faster processing times, allowing you to handle more requests in less time.

### Improved Accuracy

Our latest AI models provide better watermark removal accuracy, especially for complex watermarks and high-resolution images.

### Batch Processing

Support for asynchronous batch processing allows you to submit multiple images for processing without waiting for each one to complete.

## API Changes

### New Endpoints

- `/api/v2/process` - Enhanced processing endpoint
- `/api/v2/batch` - Batch processing support
- `/api/v2/status` - Real-time status checking

### Backward Compatibility

API 1.0 endpoints remain available for existing integrations, ensuring a smooth transition period.

## Getting Started

Check out our [API documentation](/docs/api) to learn how to integrate the new API into your applications.

## Conclusion

ClearMark API 2.0 represents our commitment to providing the best image processing experience for developers and businesses alike.""",
        "published": True
    },
    {
        "title": "Video Watermark Removal Technical Deep Dive",
        "slug": "video-watermark-removal-technical-deep-dive",
        "tags": ["Video Processing", "Tutorial"],
        "featured_image": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&h=400&fit=crop&q=80",
        "content": """# Video Watermark Removal Technical Deep Dive

Video watermark removal presents unique challenges compared to image processing. This article explores the technical aspects of removing watermarks from video content.

## Technical Challenges

### Frame-by-Frame Processing

Unlike static images, videos require processing each frame while maintaining consistency across the entire sequence.

### Temporal Consistency

Maintaining temporal consistency is crucial - processed frames must flow naturally without flickering or artifacts.

### Performance Optimization

Processing video files requires significant computational resources, making optimization essential.

## Our Approach

### 1. Frame Extraction

We extract frames at optimal intervals to balance quality and processing time.

### 2. Frame Processing

Each frame is processed using our advanced inpainting algorithms, with special attention to watermark regions.

### 3. Temporal Smoothing

A post-processing step ensures smooth transitions between frames, eliminating flicker and maintaining visual consistency.

## Best Practices

- Use appropriate frame rates for your use case
- Consider compression settings for output files
- Test with sample clips before processing full videos

## Conclusion

Video watermark removal requires sophisticated techniques, but with the right approach, excellent results can be achieved.""",
        "published": True
    },
    {
        "title": "E-commerce Image Batch Processing Best Practices",
        "slug": "e-commerce-image-batch-processing-best-practices",
        "tags": ["Case Study", "E-commerce"],
        "featured_image": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop&q=80",
        "content": """# E-commerce Image Batch Processing Best Practices

Large e-commerce platforms process thousands of product images daily. This case study explores how ClearMark helps businesses streamline their image processing workflows.

## The Challenge

E-commerce platforms need to:
- Process large volumes of product images
- Maintain consistent quality across all images
- Remove watermarks and branding from supplier images
- Ensure fast processing times

## The Solution

### Batch Processing

Our batch processing API allows e-commerce platforms to submit hundreds of images simultaneously, processing them efficiently in the background.

### Quality Consistency

Automated quality checks ensure all processed images meet your standards, reducing manual review time.

### Integration

Simple API integration allows seamless workflow integration with existing e-commerce platforms.

## Real-World Results

### Case Study: Major Online Retailer

A major online retailer uses ClearMark to process over 10,000 product images daily:

- **Processing Time**: Reduced from 8 hours to 2 hours
- **Quality Improvement**: 95% of images require no manual adjustment
- **Cost Savings**: 60% reduction in manual labor costs

## Best Practices

1. **Organize Images**: Group images by category or priority
2. **Monitor Progress**: Use status endpoints to track batch processing
3. **Quality Control**: Implement automated quality checks
4. **Scalability**: Plan for peak processing times

## Conclusion

ClearMark's batch processing capabilities make it an ideal solution for e-commerce platforms looking to streamline their image processing workflows.""",
        "published": True
    },
    {
        "title": "Image Quality Assessment Metrics Explained",
        "slug": "image-quality-assessment-metrics-explained",
        "tags": ["Technology", "Quality Assessment"],
        "featured_image": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=400&fit=crop&q=80",
        "content": """# Image Quality Assessment Metrics Explained

Evaluating image processing quality requires understanding various metrics. This article explains the most commonly used quality assessment methods.

## Common Metrics

### PSNR (Peak Signal-to-Noise Ratio)

PSNR measures the ratio between the maximum possible power of a signal and the power of noise. It's expressed in decibels (dB).

- **Higher is better**: Typical values range from 20-50 dB
- **Use case**: Good for comparing similar images
- **Limitation**: Doesn't always correlate with visual quality

### SSIM (Structural Similarity Index)

SSIM measures the structural similarity between two images, considering luminance, contrast, and structure.

- **Range**: 0 to 1 (1 means identical)
- **Advantage**: Better correlates with human visual perception
- **Use case**: General image quality assessment

### LPIPS (Learned Perceptual Image Patch Similarity)

LPIPS uses deep learning to assess perceptual similarity between images.

- **Lower is better**: Range from 0 to 1
- **Advantage**: Closely matches human perception
- **Use case**: High-fidelity image processing evaluation

## Choosing the Right Metric

### For Watermark Removal

- **SSIM**: Best for overall quality assessment
- **LPIPS**: Best for perceptual quality
- **PSNR**: Good for technical comparison

## Implementation

Most image processing libraries provide implementations of these metrics. Choose based on your specific needs and computational resources.

## Conclusion

Understanding quality metrics helps you make informed decisions about image processing algorithms and their effectiveness.""",
        "published": True
    },
    {
        "title": "Transformer Revolution in Image Processing",
        "slug": "transformer-revolution-in-image-processing",
        "tags": ["AI Research", "Transformer"],
        "featured_image": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&h=400&fit=crop&q=80",
        "content": """# Transformer Revolution in Image Processing

Vision Transformers (ViTs) are revolutionizing image processing, challenging the dominance of Convolutional Neural Networks (CNNs) in computer vision tasks.

## The Transformer Architecture

### Self-Attention Mechanism

Transformers use self-attention to understand relationships between different parts of an image, similar to how they process text sequences.

### Patch-based Processing

Images are divided into patches, which are then processed by the transformer architecture, allowing for better understanding of global image context.

## Advantages Over CNNs

### Global Context Understanding

Unlike CNNs, which process local regions, transformers can understand global image context from the start.

### Scalability

Transformers scale better with larger models and datasets, showing improved performance as model size increases.

### Flexibility

The architecture is more flexible, allowing for easier adaptation to different image processing tasks.

## Applications in Image Processing

### Image Inpainting

Transformers excel at understanding image structure, making them ideal for inpainting tasks.

### Image Restoration

The global context understanding helps transformers restore images more effectively than CNNs.

### Super-Resolution

Transformers can better understand image features across scales, improving super-resolution results.

## Current Limitations

- **Computational Cost**: Transformers require more computational resources
- **Training Data**: Need large datasets for optimal performance
- **Fine-tuning**: More complex fine-tuning process

## Future Outlook

As transformer architectures continue to evolve, we can expect:
- More efficient models
- Better performance on smaller datasets
- Improved integration with existing CNN architectures

## Conclusion

The transformer revolution in image processing is just beginning. As these models continue to improve, they will likely become the standard for many computer vision tasks.""",
        "published": True
    }
]


def init_posts(db: Session):
    """Initialize sample posts in the database"""
    # Check if posts already exist
    existing_count = db.query(Post).count()
    if existing_count > 0:
        print(f"⚠️  {existing_count} posts already exist. Skipping initialization.")
        print("   To reinitialize, delete existing posts first.")
        return

    print("📝 Initializing blog posts...")

    # Try to get an existing user, or create a default user ID
    existing_user = db.query(Profile).first()
    if existing_user:
        default_user_id = existing_user.id
        print(f"   Using existing user: {existing_user.email}")
    else:
        # Create a default user ID if no users exist
        default_user_id = str(uuid.uuid4())
        print(f"   ⚠️  No users found. Using default user ID: {default_user_id}")
        print(f"   ⚠️  Note: Posts will be created but may not be accessible without a real user.")

    for i, post_data in enumerate(SAMPLE_POSTS, 1):
        try:
            # Calculate read time (approximate 200 words per minute)
            word_count = len(post_data["content"].split())
            read_time = max(1, round(word_count / 200))
            
            post = Post(
                id=str(uuid.uuid4()),
                title=post_data["title"],
                slug=post_data["slug"],
                content=post_data["content"],
                excerpt=post_data.get("excerpt") or (post_data["content"][:200] + "..." if len(post_data["content"]) > 200 else post_data["content"]),
                tags=post_data["tags"],
                featured_image=post_data.get("featured_image"),
                published=post_data["published"],
                author_id=default_user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(post)
            print(f"  ✅ Created post {i}: {post_data['title']}")
        except Exception as e:
            print(f"  ❌ Failed to create post {i}: {e}")
            db.rollback()
            return

    try:
        db.commit()
        print(f"✅ Successfully initialized {len(SAMPLE_POSTS)} blog posts!")
    except Exception as e:
        print(f"❌ Failed to commit posts: {e}")
        db.rollback()
        raise


if __name__ == "__main__":
    print("======================================")
    print("Blog Posts Initialization Script")
    print("======================================")
    print()
    
    db = SessionLocal()
    try:
        init_posts(db)
    except Exception as e:
        print(f"❌ Error initializing posts: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
        print()
        print("======================================")

