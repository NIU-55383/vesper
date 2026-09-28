"""Original procedural foley and isolated notes, not recordings or a quoted composition.
Regenerate with Python 3 + NumPy: python generate.py. All seeds and sample counts are fixed.
"""
from pathlib import Path
import hashlib, json, math, wave
import numpy as np

ROOT=Path(__file__).resolve().parent
SR=22050
rng=np.random.default_rng(19310017)

def time(n): return np.arange(round(n*SR))/SR

def filt(x, low=0, high=5000):
    # A soft spectral band avoids brittle white-noise percussion.
    f=np.fft.rfftfreq(len(x),1/SR)
    transfer=1/(1+(f/max(high,1))**6)
    if low: transfer*=1-1/(1+(f/low)**6)
    return np.fft.irfft(np.fft.rfft(x)*transfer,n=len(x))

def noise(n,low=0,high=5000): return filt(rng.normal(0,1,round(n*SR)),low,high)

def smoothenv(t,start,duration):
    u=np.clip((t-start)/duration,0,1)
    return np.sin(np.pi*u)**2

def ring(n,freqs,decays,gains):
    t=time(n); x=np.zeros_like(t)
    for f,d,g in zip(freqs,decays,gains):
        x+=g*np.sin(2*np.pi*f*t)*np.exp(-t/d)*(1-np.exp(-t/.0025))
    return x

def add(x,y,at=0,gain=1):
    i=round(at*SR); n=min(len(y),len(x)-i)
    if n>0: x[i:i+n]+=y[:n]*gain

def reverb(x,wet=.20,tail=1.2):
    # Sparse, irregular early reflections and a quiet filtered diffuse tail.
    out=np.pad(x,(0,round(tail*SR)))
    for at,g in [(.083,.40),(.137,-.29),(.229,.25),(.347,.19),(.491,-.13),(.713,.085),(.941,.055)]:
        add(out,filt(x,0,2800),at,wet*g)
    return out

manifest={}
def save(name,x,peak=.48,room=.18,loop=False):
    x=np.array(x,dtype=float)
    if room: x=reverb(x,room)
    if not loop:
        n=min(round(.006*SR),len(x)//2);x[:n]*=np.linspace(0,1,n);x[-n:]*=np.linspace(1,0,n)
    value=np.max(np.abs(x))
    if value>0:x*=peak/value
    pcm=np.rint(np.clip(x,-1,1)*32767).astype('<i2')
    p=ROOT/(name+'.wav')
    with wave.open(str(p),'wb') as w:
        w.setparams((1,2,SR,len(pcm),'NONE','not compressed'));w.writeframes(pcm.tobytes())
    manifest[name]={'file':p.name,'seconds':round(len(pcm)/SR,4),'peak':round(float(np.max(np.abs(pcm))/32767),4),'rms':round(float(np.sqrt(np.mean((pcm.astype(float)/32767)**2))),5),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'loop':loop}

# A low, ordinary knock beneath the stone, with no horror stinger or pitch rise.
x=ring(.75,[63,109,181],[.09,.046,.025],[.40,.11,.03]);save('stone',x,peak=.24,room=.19)

# Two neutral, understated public-space bell tones, with no speech or melody quotation.
x=np.zeros(round(2.65*SR))
for at,f in [(0,659.255),(.45,523.251)]:add(x,ring(1.8,[f,f*2.006,f*3.01],[.54,.29,.17],[1,.09,.025]),at)
save('terminalChime',x,peak=.40,room=.24)

# A wood-on-stone scrape: uneven friction, small feet impacts and bending wood modes.
t=time(2.75); scrape=noise(2.75,170,2700)
pulses=sum(smoothenv(t,a,d) for a,d in [(0.12,.46),(.61,.40),(1.01,.67),(1.83,.48)])
texture=(.48+.3*np.sin(2*np.pi*29*t+.4*np.sin(t*7))**2)
x=scrape*pulses*texture*.35
phase=2*np.pi*(235*t+22*np.sin(2*np.pi*1.6*t)/(2*np.pi*1.6))
x+=(np.sin(phase)+.16*np.sin(phase*2.01))*pulses*.09
for at in [.03,.48,1.77,2.4]:add(x,ring(.25,[94,173,319],[.075,.032,.028],[.24,.18,.04]),at)
save('realityChair',x,peak=.43,room=.30)

t=time(.9);x=noise(.9,650,6900)*(smoothenv(t,.04,.25)+.72*smoothenv(t,.39,.34))
x+=noise(.9,2800,8000)*(.12+.09*np.sin(t*260))*smoothenv(t,.12,.49)
save('paper',x,peak=.37,room=.13)
t=time(1.05);save('cloth',noise(1.05,160,1900)*(smoothenv(t,.02,.62)+.42*smoothenv(t,.58,.34)),peak=.29,room=.10)
x=np.zeros(round(.42*SR));add(x,ring(.22,[223,681,1217],[.055,.028,.019],[.43,.26,.05]));add(x,noise(.09,600,4800)*np.exp(-time(.09)*75),.035,.1);save('latch',x,peak=.43,room=.22)
x=ring(.6,[175,483,1181],[.070,.065,.17],[.30,.18,.055]);save('cup',x,peak=.35,room=.16)
t=time(.70);save('breath',noise(.7,180,2300)*smoothenv(t,.01,.64),peak=.18,room=.05)
for name,rate in [('tapeStart',1),('tapeStop',.7)]:
    x=np.zeros(round(.46*SR));add(x,ring(.18,[166,419,729],[.045,.019,.013],[.5,.18,.06]));add(x,noise(.25,240,2000)*np.exp(-time(.25)*15),.10,.16*rate);save(name,x,peak=.36,room=.07)
t=time(2.5);env=smoothenv(t,.01,2.3)*(.65+.2*np.sin(t*13)+.1*np.sin(t*53))
x=noise(2.5,120,2600)*env
for at in [.20,.69,1.11,1.62,2.05]:add(x,ring(.18,[290,681],[.035,.014],[.13,.055]),at)
save('curtain',x,peak=.34,room=.16)
x=np.zeros(round(2.1*SR));t=time(1.65);add(x,(noise(1.65,90,1200)*.10+np.sin(2*np.pi*(112*t+6*t*t))*.055)*smoothenv(t,0,1.65));add(x,ring(.5,[72,127,214],[.11,.055,.038],[.7,.3,.1]),1.54);save('door',x,peak=.45,room=.26)
x=ring(.28,[91,151,273],[.055,.041,.018],[.30,.12,.045])+noise(.28,110,1300)*np.exp(-time(.28)*29)*.055
save('footstep',x,peak=.31,room=.11)
x=ring(.9,[130.813,196],[.20,.14],[.6,.13]);save('organFail',x,peak=.24,room=.16)
for name,f in [('organCircle',261.626),('organTriangle',329.628),('organDiamond',391.995)]:
    t=time(1.2);env=(1-np.exp(-t/0.025))*np.exp(-t/0.36)
    x=sum(g*np.sin(2*np.pi*f*k*t) for k,g in [(1,1),(2,.13),(3,.045),(4,.012)])*env
    save(name,x,peak=.37,room=.35)
# Single original decaying piano-like tone. Not Experience or any musical recording.
x=ring(2.25,[261.626,523.78,786.35,1049.5,1314],[.50,.28,.17,.11,.07],[.6,.19,.10,.035,.015]);x+=noise(2.25,130,2600)*np.exp(-time(2.25)*50)*.006
save('pianoLast',x,peak=.34,room=.25)
# A seamless, mechanical reel loop: all tonal rates close an integer number of cycles.
t=time(2.0);x=noise(2.0,250,1600)*.001+(.002*np.sin(2*np.pi*68*t)+.0007*np.sin(2*np.pi*136*t))*(.8+.2*np.sin(2*np.pi*3*t))
# Spectral noise is periodic; equal-power short endpoint blend makes its wrap unobtrusive.
save('tapeMotor',x,peak=.065,room=0,loop=True)
(ROOT/'manifest.json').write_text(json.dumps({'sampleRate':SR,'channels':1,'format':'PCM 16 bit WAV','provenance':'Original deterministic procedural synthesis. No external recordings, speech, or copyrighted compositions. realityChair is synthetic foley, not a field recording.','assets':manifest},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(manifest),'bytes':sum(v['bytes'] for v in manifest.values()),'clipping':any(v['peak']>=.99 for v in manifest.values())}))

