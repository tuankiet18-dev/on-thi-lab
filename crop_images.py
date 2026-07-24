import os
import zipfile
from PIL import Image

# 1. Cấu hình
ZIP_FILE = 'fuoverflow_images.zip'
EXTRACT_DIR = 'temp_extracted_images'
OUTPUT_DIR = 'clean_images'

# --- THÔNG SỐ CẮT ẢNH ---
# Tùy thuộc vào kích thước của watermark, bạn điều chỉnh số pixel muốn cắt từ dưới lên.
# Nếu watermark cao khoảng 50 pixel, hãy để CROP_BOTTOM = 50.
# Script sẽ giữ lại phần từ trên cùng xuống đến sát watermark.
CROP_BOTTOM = 100
# ------------------------

def process_images():
    # Tạo thư mục đầu ra nếu chưa có
    os.makedirs(EXTRACT_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Giải nén file ZIP
    print(f"Đang giải nén {ZIP_FILE}...")
    with zipfile.ZipFile(ZIP_FILE, 'r') as zip_ref:
        zip_ref.extractall(EXTRACT_DIR)

    # Tìm và xử lý tất cả các ảnh
    processed_count = 0
    for root, _, files in os.walk(EXTRACT_DIR):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                file_path = os.path.join(root, file)
                
                # Mở ảnh
                with Image.open(file_path) as img:
                    width, height = img.size
                    
                    # Tính toán tọa độ cắt (Left, Top, Right, Bottom)
                    # Cắt toàn bộ chiều ngang, nhưng bỏ đi CROP_BOTTOM pixel ở phía dưới
                    crop_box = (0, 0, width, height - CROP_BOTTOM)
                    
                    # Cắt ảnh
                    cropped_img = img.crop(crop_box)
                    
                    # Lưu ảnh đã cắt vào thư mục output (giữ nguyên tên file)
                    output_path = os.path.join(OUTPUT_DIR, file)
                    cropped_img.save(output_path)
                    processed_count += 1

    print(f"Đã xử lý xong {processed_count} ảnh! Kết quả được lưu tại thư mục: ./{OUTPUT_DIR}")

if __name__ == "__main__":
    process_images()
