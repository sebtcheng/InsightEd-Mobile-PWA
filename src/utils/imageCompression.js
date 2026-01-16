/**
 * Utility to compress images on the client side before uploading.
 * @param {File} file - The image file to compress.
 * @param {number} maxWidth - Maximum width of the compressed image.
 * @param {number} maxHeight - Maximum height of the compressed image.
 * @param {number} quality - Compression quality (0 to 1).
 * @returns {Promise<string>} - A promise that resolves to a Base64 string of the compressed image.
 */
export const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to Base64 (JPEG for better compression of photos)
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

                // --- DEBUG LOGS ---
                const originalSizeKB = (file.size / 1024).toFixed(2);
                const estimatedCompressedSizeKB = (compressedBase64.length * 0.75 / 1024).toFixed(2);
                console.log(`📸 Image Optimization: [${file.name}]`);
                console.log(`   - Original: ${originalSizeKB} KB`);
                console.log(`   - Compressed: ~${estimatedCompressedSizeKB} KB`);
                console.log(`   - Reduction: ${(((originalSizeKB - estimatedCompressedSizeKB) / originalSizeKB) * 100).toFixed(1)}%`);

                resolve(compressedBase64);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
