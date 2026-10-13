
import heic2any from 'heic2any';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const MAX_INPUT_SIZE = 25 * 1024 * 1024;
const MAX_OUTPUT_SIZE = 5 * 1024 * 1024;

const SUPPORTED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
];

function isHeic(file: File): boolean {
    return (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        /\.(heic|heif)$/i.test(file.name)
    );
}

export async function processCostumePhoto(
    file: File
): Promise<File> {

    if (file.size > MAX_INPUT_SIZE) {
        throw new Error(
            'Please choose an image smaller than 25 MB.'
        );
    }

    if (
        !SUPPORTED_TYPES.includes(file.type) &&
        !isHeic(file)
    ) {
        throw new Error(
            'Unsupported image format.'
        );
    }

    let imageBlob: Blob = file;

    // Convert HEIC/HEIF to JPEG first.
    if (isHeic(file)) {
        const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9,
        });

        imageBlob = Array.isArray(converted)
            ? converted[0]
            : converted;
    }

    const imageUrl = URL.createObjectURL(imageBlob);

    try {
        const image = new Image();

        image.src = imageUrl;

        await image.decode();

        const scale = Math.min(
            1,
            MAX_DIMENSION /
            Math.max(
                image.naturalWidth,
                image.naturalHeight
            )
        );

        const width = Math.max(
            1,
            Math.round(image.naturalWidth * scale)
        );

        const height = Math.max(
            1,
            Math.round(image.naturalHeight * scale)
        );

        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error(
                'Unable to process image.'
            );
        }

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        const compressedBlob =
            await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(
                                new Error(
                                    'Image compression failed.'
                                )
                            );
                        }
                    },
                    'image/jpeg',
                    JPEG_QUALITY
                );
            });

        if (compressedBlob.size > MAX_OUTPUT_SIZE) {
            throw new Error(
                'Compressed image exceeds 5 MB.'
            );
        }

        return new File(
            [compressedBlob],
            'costume-photo.jpg',
            {
                type: 'image/jpeg',
            }
        );

    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}
