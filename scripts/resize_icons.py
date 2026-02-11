import os
from PIL import Image

def resize_image(input_path, output_path, size):
    try:
        if not os.path.exists(input_path):
            print(f"Error: {input_path} not found.")
            return

        with Image.open(input_path) as img:
            img = img.resize(size, Image.Resampling.LANCZOS)
            img.save(output_path, optimize=True)
            print(f"Resized {input_path} to {size} and saved to {output_path}")
    except Exception as e:
        print(f"Failed to resize {input_path}: {e}")

if __name__ == "__main__":
    # Define paths
    base_dir = r"e:\InsightEd-Mobile-PWA\public"
    app_icon = os.path.join(base_dir, "InsightED app.png")
    apple_icon = os.path.join(base_dir, "apple-touch-icon.png")

    # Resize InsightED app.png to 512x512
    resize_image(app_icon, app_icon, (512, 512))

    # Resize apple-touch-icon.png to 180x180
    resize_image(apple_icon, apple_icon, (180, 180))
