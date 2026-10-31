"""YOLOv8n ONNX pe CPU, captură locală și IR demonstrativ (nu senzor real)."""
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort
from queue_logic import Box, COCO, LANES, assign_items, lane_wait_seconds, person_extra_seconds, smooth

ASSETS = Path(__file__).parent / 'assets'

def load_model():
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    return ort.InferenceSession(str(ASSETS / 'yolov8n.onnx'), sess_options=options, providers=['CPUExecutionProvider'])

def iou(a, b):
    intersection = max(0, min(a.x+a.w, b.x+b.w)-max(a.x,b.x)) * max(0, min(a.y+a.h,b.y+b.h)-max(a.y,b.y))
    return intersection / (a.w*a.h+b.w*b.h-intersection+1e-9)

def detect(frame, session):
    height, width = frame.shape[:2]
    scale = min(640/width, 640/height)
    dw, dh = round(width*scale), round(height*scale)
    image = np.full((640, 640, 3), 114, np.uint8)
    image[:dh, :dw] = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), (dw, dh))
    tensor = np.ascontiguousarray(image.transpose(2,0,1)[None], dtype=np.float32) / 255
    prediction = session.run(None, {session.get_inputs()[0].name: tensor})[0]
    if prediction.ndim != 3 or prediction.shape[1] != 84:
        raise ValueError(f'Model YOLOv8 incompatibil: {prediction.shape}')
    pred = prediction[0]
    raw = []
    for cls, kind in COCO.items():
        for j in np.flatnonzero(pred[4+cls] >= (.3 if cls == 0 else .25)):
            cx, cy, w, h = pred[:4,j]
            if cx > dw or cy > dh:
                continue
            raw.append(Box(float((cx-w/2)/dw), float((cy-h/2)/dh), float(w/dw), float(h/dh), float(pred[4+cls,j]), kind))
    keep = []
    for box in sorted(raw, key=lambda b: b.score, reverse=True):
        if not any(k.kind == box.kind and iou(k,box) > .45 for k in keep):
            keep.append(box)
    return keep

class Estimator:
    def __init__(self, session, source):
        self.session = session
        self.source = source
        self.capture = cv2.VideoCapture(source)
        if not self.capture.isOpened():
            self.capture.release()
            raise ValueError('Nu pot deschide camera sau clipul ales.')
        self.previous = [None] * LANES
        self.ghosts = []
        self.rng = np.random.default_rng()

    def close(self):
        self.capture.release()

    def thermal_frame(self, people):
        if self.rng.random() < .1 and len(self.ghosts) < 3:
            self.ghosts.append((self.rng.random(), .4 + self.rng.random()*.4))
        if self.rng.random() < .08 and self.ghosts:
            self.ghosts.pop(0)
        sources = [(p.box.x+p.box.w/2, p.box.y+p.box.h*.35) for p in people] + self.ghosts
        yy, xx = np.mgrid[0:18,0:32]
        xx, yy = (xx+.5)/32, (yy+.5)/18
        heat = self.rng.random((18,32))*.05
        for x,y in sources:
            heat += np.exp(-(((xx-x)/.035)**2+((yy-y)/.07)**2))
        heat = np.minimum(heat,1.5)
        lane_ids = np.minimum(LANES-1, np.floor(np.arange(32)/32*LANES).astype(int))
        thermal = [float(np.count_nonzero(heat[:,lane_ids == lane] > .5))/6 for lane in range(LANES)]
        return heat, thermal

    def step(self):
        ok, frame = self.capture.read()
        if not ok and isinstance(self.source, str):
            self.capture.set(cv2.CAP_PROP_POS_FRAMES,0)
            ok, frame = self.capture.read()
        if not ok:
            raise ValueError('Nu se pot citi cadre din sursa aleasă.')
        if isinstance(self.source,str):
            fps = self.capture.get(cv2.CAP_PROP_FPS)
            for _ in range(max(0, min(60, round(fps/5))-1)):
                if not self.capture.grab():
                    break
        boxes = detect(frame,self.session)
        people = assign_items(boxes)
        heat, thermal = self.thermal_frame(people)
        lanes = []
        for i in range(LANES):
            lp = [p for p in people if p.lane == i]
            wait = smooth(self.previous[i],lane_wait_seconds(lp,thermal[i]))
            self.previous[i] = wait
            lanes.append(dict(yolo=len(lp), thermal=thermal[i], extra=sum(person_extra_seconds(p.items) for p in lp), wait=wait))
        return frame, boxes, people, heat, lanes
