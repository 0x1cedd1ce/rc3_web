function QueryableWorker(url) {
    var instance = this,
        worker = new Worker(url //, {type: "module"}
        ),
        listeners = {};

    this.defaultListener = function () {};

    this.postMessage = function (message) {
        worker.postMessage(message);
    }

    this.terminate = function () {
        worker.terminate();
    }

    this.addListener = function (name, listener) {
        listeners[name] = listener;
    }

    this.removeListener = function (name) {
        delete listeners[name];
    }

    /* 
      This functions takes at least one argument, the method name we want to query.
      Then we can pass in the arguments that the method needs.
    */
    this.sendQuery = function () {
        if (arguments.length < 1) {
            throw new TypeError('QueryableWorker.sendQuery takes at least one argument');
            return;
        }
        worker.postMessage({
            'queryMethod': arguments[0],
            'queryMethodArguments': Array.prototype.slice.call(arguments, 1)
        });
    }

    worker.onmessage = function (event) {
        if (event.data instanceof Object &&
            event.data.hasOwnProperty('queryMethodListener') &&
            event.data.hasOwnProperty('queryMethodArguments')) {
            listeners[event.data.queryMethodListener].apply(instance, event.data.queryMethodArguments);
        } else {
            this.defaultListener.call(instance, event.data);
        }
    }
}
const w = new QueryableWorker("intensityCalculations.js");

const xdim = 256;
const ydim = 256;
const zdim = 256;
var array_pd, array_t1, array_t2, result, k_data_im_re, slice_data;

const loadDataMessageHandler = function (data) {
    array_pd = data[0];
    array_t1 = data[1];
    array_t2 = data[2];
    r = document.getElementById("content");
    r.classList.remove("hidden");
    spin = document.getElementById("datasetLoading");
    spin.classList.add("hidden");
    displayDataSet();
};
w.addListener('loadData', loadDataMessageHandler);

var imgResult;
var kResult;
const resultMessageHandler = function (data) {
    //console.log("image result");
    if (data[0] != undefined) {
        imgResult = data[0];
    }
    if (data[1] != undefined) {
        kResult = data[1];
    }
    r = document.getElementById("result");
    spin = document.getElementById("scanningSpinner");
    r.classList.remove("hidden");
    spin.classList.add("hidden");
    displayAndWindow3DImage();
};
w.addListener('result', resultMessageHandler);



// Name, Label, T1, T2, T2*, PD
const params = {
    0: ["Background", 0, 0, 0, 0, 0, "subject04_bck_v.bin"],
    1: ["CSF", 1, 2569.0, 329, 58, 1, "subject04_csf_v.bin"],
    2: ["Grey Matter", 2.0, 833, 83, 69, 0.86, "subject04_gm_v.bin"],
    3: ["White Matter", 3.0, 500, 70, 61, 0.77, "subject04_wm_v.bin"],
    4: ["Fat", 4, 350.0, 70.0, 58, 1, "subject04_fat_v.bin"],
    5: ["Muscle", 5, 900.0, 47, 30, 1, "subject04_muscles_v.bin"],
    6: ["Muscle / Skin", 6, 569.0, 329, 58, 1, "subject04_muscles_skin_v.bin"],
    7: ["Skull", 7, 0, 0, 0, 0, "subject04_skull_v.bin"],
    8: ["Vessels", 8, 0, 0, 0, 0, "subject04_vessels_v.bin"],
    9: ["Around fat", 9, 500.0, 70, 61, 0.77, "subject04_fat2_v.bin"],
    10: ["Dura Matter", 10, 2569.0, 329, 58, 1, "subject04_dura_v.bin"],
    11: ["Bone Marrow", 11, 500.0, 70, 61, 0.77, "subject04_marrow_v.bin"]
}

function display3DImage(canvas, data) {
    //canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    canvas.width = xdim;
    canvas.height = ydim;
    idata = ctx.createImageData(xdim, ydim);

    slice = parseInt(document.getElementById("slice").value);

    image_result = new Uint8ClampedArray(xdim * ydim * 4);
    min = data[0];
    max = data[0];
    for (var x = 0; x < data.length; x++) {
        if (data[x] < min) min = data[x];
        if (data[x] > max) max = data[x];
    }
    for (var x = 0; x < xdim * ydim; x++) {
        image_result[4 * x] = 255.0 * ((data[x + slice * xdim * ydim] - min) / (max - min))
        image_result[4 * x + 1] = 255.0 * ((data[x + slice * xdim * ydim] - min) / (max - min))
        image_result[4 * x + 2] = 255.0 * ((data[x + slice * xdim * ydim] - min) / (max - min))
        image_result[4 * x + 3] = 255
    }

    idata.data.set(image_result);
    ctx.putImageData(idata, 0, 0);
    //dataUri = canvas.toDataURL();
    //element.src = dataUri;
}

function autoWindow2() {
    var min = imgResult[0];
    var max = imgResult[0];
    for (var i = 0; i < imgResult.length; i++) {
        if (imgResult[i] > max) max = imgResult[i];
        if (imgResult[i] < min) min = imgResult[i];
    }
    var ww = 4096 * max - 4096 * min;
    var wc = 4096 * min + ww * 0.5;
    document.getElementById("wc").value = wc;
    document.getElementById("ww").value = ww;
    displayAndWindow3DImage();
}

function autoWindow() {
    var histo = new Int32Array(2048);
    for (var i = 0; i < histo.length; i++) {
        histo[i] = 0;
    }
    for (var i = 0; i < imgResult.length; i++) {
        histo[Math.floor(imgResult[i] * histo.length)] += 1;
    }
    var thresh = 0.9 * histo.reduce((p, c) => p + c, -histo[0]);
    var wc = 1;
    var ww = 0;
    var max = histo[1];
    for (var i = 1; i < histo.length; i++) {
        if (histo[i] > max) {
            max = histo[i]
            wc = i;
        }
    }
    var sum = histo[wc];
    for (ww = 1; ww < histo.length; ww++) {
        if (ww % 2 == 0) {
            if (wc + Math.ceil(ww * 0.5) < histo.length) {
                sum += histo[wc + Math.ceil(ww * 0.5)];
            }
        } else {
            if (wc - Math.ceil(ww * 0.5) > 0) {
                sum += histo[wc - Math.ceil(ww * 0.5)];
            }
        }
        if (sum > thresh) {
            break;
        }
    }
    var start = Math.max(1, Math.ceil(wc - ww * 0.5));
    var end = Math.min(histo.length, Math.ceil(wc + ww * 0.5));
    ww = end - start;
    wc = start + Math.floor(ww * 0.5);
    document.getElementById("wc").value = (4096 / histo.length) * wc;
    document.getElementById("ww").value = (4096 / histo.length) * ww;
    displayAndWindow3DImage();
}

function scrollDataset(event) {
    slice = document.getElementById("slice")
    slice.value = slice.valueAsNumber - Math.sign(event.deltaY) * Math.max(1, Math.abs(Math.round(event.deltaY / 100)))
    if ("createEvent" in document) {
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", false, true);
        slice.dispatchEvent(evt);
    } else
        slice.fireEvent("onchange");
    event.preventDefault();
}

function scrollResult(event) {
    r_slice = document.getElementById("r_slice")
    r_slice.value = r_slice.valueAsNumber - Math.sign(event.deltaY) * Math.max(1, Math.abs(Math.round(event.deltaY / 100)))
    if ("createEvent" in document) {
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", false, true);
        r_slice.dispatchEvent(evt);
    } else
        r_slice.fireEvent("onchange");
    event.preventDefault();
}

var windowing = false;

function startWindowing() {
    windowing = true;
}

function endWindowing() {
    windowing = false;
}

function windowResult(event) {
    if (windowing) {
        ww = document.getElementById("ww")
        wc = document.getElementById("wc")

        ww.value = ww.valueAsNumber - event.movementY * 4
        wc.value = wc.valueAsNumber - event.movementX * 4

        if ("createEvent" in document) {
            var evt = document.createEvent("HTMLEvents");
            evt.initEvent("change", false, true);
            ww.dispatchEvent(evt);
        } else {
            ww.fireEvent("onchange");
        }
    }
}

function displayAndWindow3DImage() {
    //canvas = document.createElement('canvas');
    //res_element = document.getElementById("result");
    canvas = document.getElementById("imgResult");

    ctx = canvas.getContext('2d');
    canvas.width = xdim;
    canvas.height = ydim;
    idata = ctx.createImageData(xdim, ydim);

    in_ww = document.getElementById("ww");
    in_wc = document.getElementById("wc");
    in_slice = document.getElementById("r_slice");
    slice = parseInt(in_slice.value);

    image_result = new Uint8ClampedArray(xdim * ydim * 4);
    var ww = parseFloat(in_ww.value) * 0.5
    var wc = parseFloat(in_wc.value)

    for (var x = 0; x < xdim * ydim; x++) {
        val = imgResult[x + slice * xdim * ydim] * 4096
        if (val <= (wc - ww)) {
            val = 0
        } else if (val >= (wc + ww)) {
            val = 255;
        } else {
            val = 255 * (val - (wc - ww)) / (ww)
        }
        image_result[4 * x] = val
        image_result[4 * x + 1] = val
        image_result[4 * x + 2] = val
        image_result[4 * x + 3] = 255
    }

    idata.data.set(image_result);
    ctx.putImageData(idata, 0, 0);

    k_canvas = document.getElementById("kResult");
    k_canvas.width = xdim;
    k_canvas.height = ydim
    k_ctx = k_canvas.getContext('2d');
    kdata = k_ctx.createImageData(xdim, ydim);

    var mult = document.getElementById("kspacemult").valueAsNumber;
    var xlines = document.getElementById("k_xline").valueAsNumber;
    var ylines = document.getElementById("k_yline").valueAsNumber;
    var fmin = document.getElementById("k_fmin").valueAsNumber;
    var fmax = document.getElementById("k_fmax").valueAsNumber;
    var dx = xdim / xlines;
    var dy = ydim / ylines;
    k_result = new Uint8ClampedArray(xdim * ydim * 4);
    for (var index = 0; index < xdim * ydim; index++) {
        val = kResult[index + slice * xdim * ydim] * mult

        var y = Math.floor(index / xdim);
        var x = index % xdim;
        var f = Math.sqrt((x - xdim / 2) * (x - xdim / 2) + (y - ydim / 2) * (y - ydim / 2));
        var res1 = f >= fmin && f <= fmax;
        var res = res1 && ((Math.floor(x / dx) * dx - x) < 1 && (Math.floor(x / dx) * dx - x) > -1) && ((Math.floor(y / dy) * dy - y) < 1 && (Math.floor(y / dy) * dy - y) > -1);

        if (!res) {
            k_result[4 * index] = 255
            k_result[4 * index + 1] = 0
            k_result[4 * index + 2] = 0
            k_result[4 * index + 3] = 255
        } else {
            k_result[4 * index] = val
            k_result[4 * index + 1] = val
            k_result[4 * index + 2] = val
            k_result[4 * index + 3] = 255
        }
    }

    kdata.data.set(k_result);
    k_ctx.putImageData(kdata, 0, 0);
}

function loadFuzzyDataSet() {
    content = document.getElementById("content");
    content.classList.add("hidden");
    return new Promise(async (resolve, reject) => {

        slice = document.getElementById("slice");
        slice.max = zdim;
        slice.value = 100;

        spin = document.getElementById("datasetLoading");
        spin.classList.remove("hidden");

        w.sendQuery("loadData");
        resolve();
    });
}

function setSpinEcho() {
    var seTab = document.getElementById("params-se");
    var irTab = document.getElementById("params-ir");
    var seTabHead = document.getElementById("params-se-tab");
    var irTabHead = document.getElementById("params-ir-tab");
    irTab.classList.remove("active", "show");
    seTab.classList.add("active", "show");
    irTabHead.classList.remove("active");
    seTabHead.classList.add("active");
}

function spinEcho() {
    r = document.getElementById("result");
    spin = document.getElementById("scanningSpinner");
    slice = document.getElementById("r_slice");
    slice.max = zdim;
    r.classList.add("hidden");
    spin.classList.remove("hidden");

    var te = parseFloat(document.getElementById("se_te").value)
    var tr = parseFloat(document.getElementById("se_tr").value)

    w.sendQuery("spinEcho", te, tr);
}

function setInversionRecovery() {
    var seTab = document.getElementById("params-se");
    var irTab = document.getElementById("params-ir");
    var seTabHead = document.getElementById("params-se-tab");
    var irTabHead = document.getElementById("params-ir-tab");
    seTab.classList.remove("active", "show");
    irTab.classList.add("active", "show");
    seTabHead.classList.remove("active");
    irTabHead.classList.add("active");
}

function inversionRecovery() {
    r = document.getElementById("result");
    spin = document.getElementById("scanningSpinner");
    slice = document.getElementById("r_slice");
    slice.max = zdim;
    r.classList.add("hidden");
    spin.classList.remove("hidden");

    var ti = parseFloat(document.getElementById("ir_ti").value)
    var tr = parseFloat(document.getElementById("ir_tr").value)

    w.sendQuery("inversionRecovery", ti, tr);
}

function reco(update_slider, noIfft = false) {
    var xlines, ylines, fmin, fmax;
    if (update_slider) {
        xlines = document.getElementById("k_xline_number").valueAsNumber;
        ylines = document.getElementById("k_yline_number").valueAsNumber;
        fmin = document.getElementById("k_fmin_number").valueAsNumber;
        fmax = document.getElementById("k_fmax_number").valueAsNumber;
        document.getElementById("k_xline").value = xlines;
        document.getElementById("k_yline").value = ylines;
        document.getElementById("k_fmin").value = fmin;
        document.getElementById("k_fmax").value = fmax;
    } else {
        xlines = document.getElementById("k_xline").valueAsNumber;
        ylines = document.getElementById("k_yline").valueAsNumber;
        fmin = document.getElementById("k_fmin").valueAsNumber;
        fmax = document.getElementById("k_fmax").valueAsNumber;
        document.getElementById("k_xline_number").value = xlines;
        document.getElementById("k_yline_number").value = ylines;
        document.getElementById("k_fmin_number").value = fmin;
        document.getElementById("k_fmax_number").value = fmax;
    }
    w.sendQuery("reco", xlines, ylines, fmin, fmax, noIfft);
}

function startScan() {
    var seTab = document.getElementById("params-se-tab").classList.contains("active");
    var irTab = document.getElementById("params-ir-tab").classList.contains("active");
    if (seTab) {
        spinEcho();
    }
    if (irTab) {
        inversionRecovery();
    }
}

function displayDataSet() {
    display3DImage(document.getElementById("imgPD"), array_pd);
    display3DImage(document.getElementById("imgT1"), array_t1);
    display3DImage(document.getElementById("imgT2"), array_t2);
}