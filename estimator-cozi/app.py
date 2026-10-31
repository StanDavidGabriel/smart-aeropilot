"""Pornește cu: python -m streamlit run app.py"""
from datetime import datetime
from time import perf_counter
import cv2
import numpy as np
import streamlit as st
from detector import ASSETS, Estimator, load_model
from queue_logic import EXTRA_SECONDS, level
from i18n import TEXT
import unicodedata

st.set_page_config(page_title='Estimator cozi la securitate', page_icon='✈️', layout='wide')
model = st.cache_resource(load_model)

def stop():
    engine = st.session_state.pop('engine', None)
    if engine is not None:
        engine.close()
    st.session_state.pop('latest', None)

language = st.sidebar.selectbox('Limbă / Language', ['ro', 'en'], format_func=lambda code: 'Română' if code == 'ro' else 'English', key='language')
t = TEXT[language]
st.title(t['title'])
view = st.radio(t['view'], ['passengers', 'detection'], format_func=lambda key: t[key], horizontal=True, key='view')
with st.sidebar:
    st.header(t['video_source'])
    source = st.selectbox(t['source'], ['demo', 'webcam', 'local'], format_func=lambda key: t[key], key='source')
    if source == 'webcam':
        value = int(st.number_input(t['camera_number'], min_value=0, max_value=10, value=0, key='camera_number'))
    elif source == 'local':
        value = st.text_input(t['path'], key='path')
    else:
        value = str(ASSETS / 'queue.webm')
    running = st.session_state.get('engine')
    if running is not None and running.source != value:
        stop()
    col1, col2 = st.columns(2)
    if col1.button(t['start'], disabled='engine' in st.session_state, type='primary'):
        try:
            if not str(value).strip():
                raise ValueError(t['missing_path'])
            with st.spinner(t['loading']):
                st.session_state.engine = Estimator(model(), value)
        except Exception as exc:
            st.error(t['missing_path'] if not str(value).strip() else t['start_error'])
    col2.button(t['stop'], on_click=stop, disabled='engine' not in st.session_state)
    show_heat = st.checkbox(t['heat'], value=True, key='heat')
    st.caption(t['disclaimer'])

@st.fragment(run_every=.2)
def live():
    engine = st.session_state.get('engine')
    if engine is None:
        st.info(t['stopped'])
        return
    try:
        t0 = perf_counter()
        frame, boxes, people, heat, lanes = engine.step()
        elapsed = perf_counter()-t0
    except Exception as exc:
        stop()
        st.error(t['error'] + '. ' + t['start_error'])
        return
    best = min(range(len(lanes)), key=lambda i:lanes[i]['wait'])
    if view == 'passengers':
        for i,lane in enumerate(lanes):
            minutes = lane['wait']/60
            wait = '<1' if minutes < 1 else f'~{int(minutes+.5)}'
            cols = st.columns([2,1])
            cols[0].subheader(f"{t['lane']} {i+1}")
            cols[0].write(t[level(minutes)] + (' · ' + t['fastest'] if i == best else ''))
            cols[1].metric(t['wait'], f'{wait} min')
            st.divider()
    else:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h,w = rgb.shape[:2]
        if show_heat:
            mapped = cv2.applyColorMap((np.clip(heat,0,1)*255).astype(np.uint8), cv2.COLORMAP_JET)
            thermal = cv2.cvtColor(cv2.resize(mapped,(w,h),interpolation=cv2.INTER_NEAREST),cv2.COLOR_BGR2RGB)
            rgb = cv2.addWeighted(rgb,.7,thermal,.3,0)
        for i in (1,2):
            cv2.line(rgb,(w*i//3,0),(w*i//3,h),(240,240,240),2)
        for b in boxes:
            x,y = max(0,int(b.x*w)),max(0,int(b.y*h))
            color = (75,220,145) if b.kind == 'person' else (245,195,70)
            cv2.rectangle(rgb,(x,y),(int((b.x+b.w)*w),int((b.y+b.h)*h)),color,2)
            # OpenCV Hershey fonts are ASCII; Romanian labels are shown below.
            cv2.putText(rgb,f"{unicodedata.normalize('NFKD', t[b.kind]).encode('ascii', 'ignore').decode()} {b.score:.0%}",(x,max(18,y-5)),cv2.FONT_HERSHEY_SIMPLEX,.5,color,1)
        video_col, data_col = st.columns([2,1])
        video_col.image(rgb, caption=f"YOLOv8n · {len(boxes)} {t['objects']} · {1/max(.2,elapsed):.1f} {t['fps']}")
        with data_col:
            for i,lane in enumerate(lanes):
                st.subheader(f"{t['lane']} {i+1}")
                st.write(f"YOLO: {lane['yolo']} {t['people']} · {t['simulated_ir']}: {lane['thermal']:.1f}")
                st.write(f"{t['bags']}: +{lane['extra']/60:.1f} min")
                st.metric(t['wait'], f"{lane['wait']/60:.1f} min")
        st.subheader(t['detected'])
        st.write(' · '.join(f"#{i+1} B{p.lane+1}: {', '.join(t[k] for k in p.items) or t['nothing_detected']}" for i,p in enumerate(people)) or t['no_people'])
        st.caption(t['formula'])
        st.write(' · '.join(f'{t[k]}: +{v/60:g} min' for k,v in EXTRA_SECONDS.items())+' · '+t['nothing']+': +0 min')
    st.caption(f"{t['updated']} {datetime.now():%H:%M:%S} · {t['margin']}")

live()
