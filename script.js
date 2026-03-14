const upload = document.getElementById("upload");
const preview = document.getElementById("preview");
const download = document.getElementById("download");
const widthInput = document.getElementById("width_cm");
const textInput = document.getElementById("text_input");

const panelCm = 18;
const canvasSize = 500;
const canvas = document.createElement("canvas");
canvas.width = canvasSize;
canvas.height = canvasSize;
const ctx = canvas.getContext("2d");

let originalImage = null;
let croppedImage = null;

// 업로드 시: 크롭 + 캔버스 최대 크기 맞춰 미리보기
upload.addEventListener("change", () => {
    const file = upload.files[0];
    if (!file) return;

    document.querySelector(".file-btn").textContent = file.name;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
        originalImage = img;
        croppedImage = cropTransparentEdges(originalImage);
        drawPreview(croppedImage);
    };
});

// 리사이즈 버튼 클릭: 크롭 이미지 기준으로 가로(cm) 비율 + 글씨 포함
document.getElementById("resizeBtn").addEventListener("click", () => {
    if (!croppedImage) return;
    const userCm = parseFloat(widthInput.value);
    const userText = textInput.value;

    // 폰트가 완전히 로드된 후에 drawResized 실행
    document.fonts.load('10px Nanum').then(() => {
        drawResized(croppedImage, userCm, userText);
    });
});

// 크롭 함수 (알파 임계값 적용)
function cropTransparentEdges(img) {
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = img.width;
    tmpCanvas.height = img.height;
    const tmpCtx = tmpCanvas.getContext("2d");
    tmpCtx.drawImage(img, 0, 0);
    const data = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height).data;

    let minX = img.width, minY = img.height;
    let maxX = 0, maxY = 0;
    let hasOpaque = false;
    const alphaThreshold = 10;

    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const alpha = data[(y * img.width + x) * 4 + 3];
            if (alpha > alphaThreshold) {
                hasOpaque = true;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (!hasOpaque) { minX = 0; minY = 0; maxX = img.width - 1; maxY = img.height - 1; }

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    const cropCtx = cropCanvas.getContext("2d");
    cropCtx.drawImage(img, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    return cropCanvas;
}

// 미리보기: 햄버거만 중앙
function drawPreview(cropCanvas) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const cropWidth = cropCanvas.width;
    const cropHeight = cropCanvas.height;

    let scale = Math.min(canvasSize / cropWidth, canvasSize / cropHeight, 1);
    const drawWidth = Math.round(cropWidth * scale);
    const drawHeight = Math.round(cropHeight * scale);

    const offsetX = Math.round((canvasSize - drawWidth) / 2);
    const offsetY = Math.round((canvasSize - drawHeight) / 2);

    ctx.drawImage(cropCanvas, 0, 0, cropWidth, cropHeight, offsetX, offsetY, drawWidth, drawHeight);

    preview.src = canvas.toDataURL("image/jpeg", 0.92);
}

// 리사이즈 + 글씨 포함
function drawResized(cropCanvas, userCm, userText) {
    const cropWidth = cropCanvas.width;
    const cropHeight = cropCanvas.height;

    const correction = 11 / 10.2; // 실제 팬 오차 보정계수
    const ratio = (userCm / panelCm) * correction;
    const drawWidth = Math.round(canvasSize * ratio);
    const drawHeight = Math.round(drawWidth * (cropHeight / cropWidth));
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const fontSize = 65; // px
    const padding = 10;
    const groupHeight = drawHeight + fontSize + padding;
    const offsetX = Math.round((canvasSize - drawWidth) / 2);
    const offsetY = Math.round((canvasSize - groupHeight) / 2);
    // 폰트 적용
    ctx.font = `${fontSize}px Heavy`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";

    // 햄버거 그림
    ctx.drawImage(cropCanvas, 0, 0, cropWidth, cropHeight, offsetX, offsetY, drawWidth, drawHeight);

    // 글씨 그림
    const textX = canvasSize / 2;
    const textY = offsetY + drawHeight + fontSize; // baseline 기준
    if (userText) ctx.fillText(userText, textX, textY);

    // 미리보기 + 다운로드
    preview.src = canvas.toDataURL("image/jpeg", 0.92);
    download.href = canvas.toDataURL("image/jpeg", 0.92);
    download.download = "resized.jpg";
}