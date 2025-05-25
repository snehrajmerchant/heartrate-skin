// Heart rate and image processing logic split from index.js

// Normalize array to a fixed length
function normalizeArray(data, length) {
    var res = [];
    if (data.length < length)
        return data;
    for (var i = data.length - length; i < data.length; i++)
        res.push(data[i]);
    return res;
}

// Discrete Fourier Transform (not used in new HR, but kept for reference)
function dft(data) {
    // Accepts an array of numbers
    var N = data.length;
    var res = [];
    for (var k = 0; k < N; k++) {
        var re = 0, im = 0;
        for (var n = 0; n < N; n++) {
            var angle = (2 * Math.PI * k * n) / N;
            re += data[n] * Math.cos(angle);
            im -= data[n] * Math.sin(angle);
        }
        res.push(Math.sqrt(re * re + im * im));
    }
    return res;
}


// New function to estimate heart rate from data points using moving average
function findHeartRateFromDataPoints(points, duration) {
    const n = 18;
    if (!points || points.length < n) return 0;
    let sum = 0;
    for (let i = points.length - n; i < points.length; i++) {
        sum += points[i];
    }
    let avg = sum / n;
    return Math.round(avg);
}

// Export for use in index.js
window.HRProcessing = {
    normalizeArray,
    dft,
    findHeartRateFromDataPoints
};
