interface CostumePhotoFrame {
    photoUrl: string | null;
    costumeName?: string;
}

export default function CostumePhotoFrame({photoUrl, costumeName = 'Costume photo'}: CostumePhotoFrame) {
    return (
        <div className="costume-photo-frame">
            <div className="costume-photo-frame-image-area">
                {photoUrl ? (
                    <img src={photoUrl} alt={costumeName} className="costume-photo-frame-image" />
                ) : (
                    <div className="costume=photo-frame-placeholder">
                        ✦ No Photo ✦
                    </div>
                )}
            </div>

            <img
                src="/images/tarot-frame.png"
                alt=""
                aria-hidden="true"
                className="costume-photo-frame-overlay"
            />
        </div>
    );
}