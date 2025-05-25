var canvas, context; // fixed typo
var unprocessedData = [];
var processedData = [];
// Remove average from here, now in hr-processing.js

window.addEventListener('DOMContentLoaded', function () {
    // Put event listeners into place

    // Grab elements, create settings, etc.
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d", { willReadFrequently: true });
    // Remove any dynamically created video element at the top of the body for debugging
    var extraVideo = document.querySelector('body > video#video');
    if (extraVideo && !document.getElementById('video')) {
        extraVideo.parentNode.removeChild(extraVideo);
    }
    // FIX: Ensure video element exists in HTML (but do not create a new one at the top of the body)
    var video = document.getElementById("video");
    if (!video) {
        console.error('Video element not found!');
        return;
    }
    var videoObj = { "video": true },
        errBack = function (error) {
            console.log("Video capture error: ", error.code);
        };

    // Ensure video is hidden and not moved in the DOM
    video.style.display = 'none';
    video.removeAttribute('width');
    video.removeAttribute('height');
    // Do not move or show the video element

    // Add error logging for video
    video.onerror = function(e) {
        console.error('Video element error:', e);
    };
    // Add error logging for stream
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function (stream) {
                video.srcObject = stream;
                video.play();
                console.log('Video stream started');
            })
            .catch(function(error) {
                console.error('getUserMedia error:', error);
                errBack(error);
            });
    } else if (navigator.getUserMedia) { // Legacy
        navigator.getUserMedia(videoObj, function (stream) {
            video.srcObject = stream;
            video.play();
            console.log('Legacy getUserMedia stream started');
        }, function(error) {
            console.error('Legacy getUserMedia error:', error);
            errBack(error);
        });
    } else if (navigator.webkitGetUserMedia) { // WebKit-prefixed
        navigator.webkitGetUserMedia(videoObj, function (stream) {
            video.src = window.URL.createObjectURL(stream);
            video.play();
            console.log('WebKit getUserMedia stream started');
        }, function(error) {
            console.error('WebKit getUserMedia error:', error);
            errBack(error);
        });
    } else if (navigator.mozGetUserMedia) { // Firefox-prefixed
        navigator.mozGetUserMedia(videoObj, function (stream) {
            video.src = window.URL.createObjectURL(stream);
            video.play();
            console.log('Moz getUserMedia stream started');
        }, function(error) {
            console.error('Moz getUserMedia error:', error);
            errBack(error);
        });
    } else {
        console.error('No getUserMedia support detected');
        errBack({ code: 'NO_SUPPORT' });
    }

    var videoHeight, videoWidth;
    var canvasCoef = 1;


    function updateCavnasImage() {
        // Use video.videoWidth and video.videoHeight for correct dimensions
        videoWidth = video.videoWidth || 320;
        videoHeight = video.videoHeight || 240;
        // Scale to fit the canvas size (which is now 180x135)
        const displayWidth = canvas.width;
        const displayHeight = canvas.height;
        context.clearRect(0, 0, displayWidth, displayHeight);
        context.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, displayWidth, displayHeight);
        processImage();
        setTimeout(updateCavnasImage, 33);
    }

    var frameCanvas = document.getElementById("frameCanvas");
    var frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });
    var trendCanvas = document.getElementById("trendGraph");
    var trendContext = trendCanvas.getContext("2d");
    var fftCanvas = document.getElementById("fftGraph");
    var fftContext = fftCanvas.getContext("2d");
    let lastHR = null;

    function processImage() {
        // Region of interest: always centered and scaled to canvas size
        const roiWidth = Math.floor(canvas.width * 0.28); // ~50px for 180px canvas
        const roiHeight = Math.floor(canvas.height * 0.22); // ~30px for 135px canvas
        const roiX = Math.floor(canvas.width / 2 - roiWidth / 2);
        const roiY = Math.floor(canvas.height / 2 - roiHeight / 2);
        var mRect = [roiX, roiY, roiWidth, roiHeight];


        var average = 0;
        var count = 0;
        // Use a circular mask in the ROI to reduce background influence
        var centerX = mRect[0] + mRect[2] / 2;
        var centerY = mRect[1] + mRect[3] / 2;
        var radius = Math.min(mRect[2], mRect[3]) / 2 * 0.9; // 90% of half-width/height
        for (var i = mRect[0]; i < mRect[0] + mRect[2]; i++) {
            for (var j = mRect[1]; j < mRect[1] + mRect[3]; j++) {
                var dx = i - centerX;
                var dy = j - centerY;
                if (dx * dx + dy * dy <= radius * radius) {
                    var pixel = context.getImageData(i, j, 1, 1).data;
                    average += pixel[1];
                    count++;
                }
            }
        }
        if (count > 0) {
            average /= count;
        }

        context.beginPath();
        context.rect(mRect[0], mRect[1], mRect[2], mRect[3]);
        context.save();
        context.globalAlpha = 0.25; // Set transparency for fill
        context.fillStyle = 'rgb(' + parseInt(average) + ',' + parseInt(average) + ',' + parseInt(average) + ')';
        context.fill();
        context.restore();
        context.lineWidth = 2;
        context.strokeStyle = 'blue';
        context.stroke();

        // Draw the region of interest to the second canvas for visualization
        frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
        // Draw only the ROI section, scaled to fill the entire frameCanvas
        frameContext.drawImage(
            canvas, // source
            mRect[0], mRect[1], mRect[2], mRect[3], // source ROI
            0, 0, frameCanvas.width, frameCanvas.height // destination: full canvas
        );
        // Optionally, draw a transparent overlay or border to indicate ROI
        frameContext.save();
        frameContext.globalAlpha = 0.25;
        frameContext.fillStyle = 'rgb(' + parseInt(average) + ',' + parseInt(average) + ',' + parseInt(average) + ')';
        frameContext.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
        frameContext.restore();
        frameContext.lineWidth = 2;
        frameContext.strokeStyle = 'red';
        frameContext.strokeRect(0, 0, frameCanvas.width, frameCanvas.height);

        unprocessedData.push([average, Date.now()]);
        // Reduce window size for faster response (e.g., 150 points ~5 seconds)
        processedData = normalizeArray(unprocessedData, 150);

        // Extract only the average values for display and DFT
        var intPoints = processedData.map(function (item) { return parseInt(item[0]); });

        // Replace jQuery .text() and .show()/.hide() with vanilla JS
        function setDataPointsText(text) {
            document.getElementById('dataPoints').textContent = text;
        }
        function setHeartRateText(text) {
            document.getElementById('heartRate').textContent = text;
        }
        function showUserPrompt(show) {
            document.getElementById('userPrompt').style.display = show ? 'block' : 'none';
        }

        // In processImage, replace jQuery with vanilla JS
        setDataPointsText(intPoints.join(', '));
        // Always scroll dataPoints to bottom to show latest data
        var dataPointsDiv = document.getElementById('dataPoints');
        dataPointsDiv.scrollTop = dataPointsDiv.scrollHeight;

        // Draw trend graph of data points
        drawTrendGraph(intPoints);

        // Draw FFT (DFT) graph
        if (intPoints.length > 32) {
            var dftData = HRProcessing.dft(intPoints);
            drawFFTGraph(dftData);
        } else {
            drawFFTGraph([]);
        }

        // Show heart rate and user prompt after 150 points (not 450)
        if (processedData.length > 149) {
            var hr = HRProcessing.findHeartRateFromDataPoints(intPoints, processedData[processedData.length - 1][1] - processedData[0][1]);
            lastHR = hr;
            if (hr > 0) {
                setHeartRateText(hr);
                showUserPrompt(false);
            } else {
                setHeartRateText('N/A');
                showUserPrompt(true);
            }
            console.log('Heart Rate Detected:', hr);
        } else {
            setHeartRateText('N/A');
            showUserPrompt(true);
        }
        // Use HRProcessing.normalizeArray
        unprocessedData = HRProcessing.normalizeArray(unprocessedData, 150);

        // Detect excessive motion/variation in data points
        let showMotionWarning = false;
        if (intPoints.length > 20) {
            // Calculate standard deviation of last 20 points
            let recent = intPoints.slice(-20);
            let mean = recent.reduce((a, b) => a + b, 0) / recent.length;
            let variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
            let stddev = Math.sqrt(variance);
            // Threshold: adjust as needed (e.g., > 10 is a lot of variation for green channel)
            if (stddev > 10) showMotionWarning = true;
        }
        // Show/hide motion warning
        let motionWarningDiv = document.getElementById('motionWarning');
        if (!motionWarningDiv) {
            motionWarningDiv = document.createElement('div');
            motionWarningDiv.id = 'motionWarning';
            motionWarningDiv.style.display = 'none';
            motionWarningDiv.style.fontWeight = 'bold';
            motionWarningDiv.style.fontSize = '16px';
            motionWarningDiv.style.color = '#e53935';
            motionWarningDiv.style.textAlign = 'center';
            motionWarningDiv.style.margin = '8px 0 0 0';
            // Insert under heartRate in the heart rate card
            let heartRateDiv = document.getElementById('heartRate');
            if (heartRateDiv && heartRateDiv.parentElement) {
                heartRateDiv.parentElement.insertBefore(motionWarningDiv, heartRateDiv.nextSibling);
            }
        }
        if (showMotionWarning) {
            motionWarningDiv.textContent = 'Too much motion detected! Please stay still for accurate measurement.';
            motionWarningDiv.style.display = 'block';
        } else {
            motionWarningDiv.style.display = 'none';
        }
    }

    function drawTrendGraph(points) {
        trendContext.clearRect(0, 0, trendCanvas.width, trendCanvas.height);
        if (!points || points.length < 2) return;
        let max = Math.max(...points);
        let min = Math.min(...points);
        let range = max - min || 1;
        let w = trendCanvas.width;
        let h = trendCanvas.height;
        // Draw Y axis scale
        trendContext.save();
        trendContext.font = '12px Arial';
        trendContext.fillStyle = '#333';
        trendContext.textAlign = 'right';
        trendContext.fillText(max, 40, 15);
        trendContext.fillText(min, 40, h - 5);
        trendContext.restore();
        // Draw trend line
        trendContext.beginPath();
        trendContext.moveTo(50, h - ((points[0] - min) / range) * h);
        for (let i = 1; i < points.length; i++) {
            let x = 50 + (i / (points.length - 1)) * (w - 60);
            let y = h - ((points[i] - min) / range) * h;
            trendContext.lineTo(x, y);
        }
        trendContext.strokeStyle = '#1976D2';
        trendContext.lineWidth = 2;
        trendContext.stroke();
        // Draw Y axis line
        trendContext.beginPath();
        trendContext.moveTo(50, 0);
        trendContext.lineTo(50, h);
        trendContext.strokeStyle = '#888';
        trendContext.lineWidth = 1;
        trendContext.stroke();
    }

    function drawFFTGraph(dftData) {
        fftContext.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
        if (!dftData || dftData.length < 2) return;
        let max = Math.max(...dftData);
        let w = fftCanvas.width;
        let h = fftCanvas.height;
        // Draw Y axis scale (amplitude)
        fftContext.save();
        fftContext.font = '12px Arial';
        fftContext.fillStyle = '#333';
        fftContext.textAlign = 'right';
        fftContext.fillText(Math.round(max), 38, 15);
        fftContext.fillText('0', 38, h - 10);
        fftContext.restore();
        // Draw X axis scale (frequency bins)
        fftContext.save();
        fftContext.font = '12px Arial';
        fftContext.fillStyle = '#333';
        fftContext.textAlign = 'center';
        fftContext.fillText('0', 45, h - 2);
        fftContext.fillText('Nyq', w - 10, h - 2);
        fftContext.fillText('Freq', w / 2, h - 2);
        fftContext.restore();
        // Center the spectrum: draw only the first half, centered horizontally
        let halfLen = Math.floor(dftData.length / 2);
        let graphWidth = w - 60;
        let barWidth = graphWidth / halfLen;
        let xStart = 50 + (graphWidth / 4); // Center the first half in the graph
        for (let i = 0; i < halfLen; i++) {
            let x = xStart + i * barWidth;
            let y = h - (dftData[i] / max) * (h - 25) - 10;
            fftContext.fillStyle = '#1976D2';
            fftContext.fillRect(x, y, barWidth * 0.8, h - y - 15);
        }
        // Draw Y axis line
        fftContext.beginPath();
        fftContext.moveTo(50, 0);
        fftContext.lineTo(50, h - 10);
        fftContext.strokeStyle = '#888';
        fftContext.lineWidth = 1;
        fftContext.stroke();
        // Draw X axis line
        fftContext.beginPath();
        fftContext.moveTo(50, h - 10);
        fftContext.lineTo(w - 10, h - 10);
        fftContext.strokeStyle = '#888';
        fftContext.lineWidth = 1;
        fftContext.stroke();
        // Draw legend
        fftContext.save();
        fftContext.font = '12px Arial';
        fftContext.fillStyle = '#1976D2';
        fftContext.fillText('Amplitude', 20, 20);
        fftContext.fillStyle = '#333';
        fftContext.fillText('Frequency Bin (not Hz)', w / 2, h - 25);
        fftContext.restore();
    }


    //setTimeout(function(){

    updateCavnasImage();
    //},2000);
});
