"""Texte pentru selectorul Română / English; fără schimbarea regulilor."""
TEXT = {
 'ro': {
  'title':'Timp de așteptare la securitate','view':'Afișaj','passengers':'Pasageri','detection':'Detecție',
  'video_source':'Sursa video','source':'Sursă','demo':'Clip demonstrativ','webcam':'Camera web','local':'Clip local',
  'camera_number':'Numărul camerei','path':'Calea completă către clip','start':'Pornește','stop':'Oprește',
  'missing_path':'Introdu calea către un clip.','loading':'Se încarcă YOLOv8…',
  'heat':'Suprapunere IR simulată','disclaimer':'IR este simulat, nu provine dintr-o cameră termică. Clipul inclus este generat pentru demonstrație.',
  'stopped':'Detecția este oprită.','error':'Detecția s-a oprit','start_error':'Nu pot porni detecția. Verifică sursa video și modelul.',
  'lane':'Banda','fastest':'Cea mai rapidă','wait':'Așteptare','objects':'obiecte','fps':'cadre/s','people':'pers.',
  'simulated_ir':'IR simulat','bags':'Bagaje','detected':'Persoane detectate','nothing_detected':'nimic detectat',
  'no_people':'Nicio persoană detectată','formula':'persoane = 0,7 × YOLO + 0,3 × IR; așteptare = persoane × 30 s + timp bagaje',
  'nothing':'Nimic','updated':'Actualizat','margin':'Estimare cu marjă pentru controale suplimentare',
  'Fluent':'Fluent','Moderat':'Moderat','Aglomerat':'Aglomerat',
  'person':'Persoană','backpack':'Rucsac','suitcase':'Valiză','laptop':'Laptop','handbag':'Geantă',
 },
 'en': {
  'title':'Security queue wait times','view':'Display','passengers':'Passengers','detection':'Detection',
  'video_source':'Video source','source':'Source','demo':'Demo video','webcam':'Webcam','local':'Local video',
  'camera_number':'Camera number','path':'Full path to video','start':'Start','stop':'Stop',
  'missing_path':'Enter a video path.','loading':'Loading YOLOv8…',
  'heat':'Simulated IR overlay','disclaimer':'IR is simulated, not measured by a thermal camera. The included video was generated for demonstration.',
  'stopped':'Detection is stopped.','error':'Detection stopped','start_error':'Cannot start detection. Check the video source and model.',
  'lane':'Lane','fastest':'Fastest','wait':'Wait time','objects':'objects','fps':'frames/s','people':'people',
  'simulated_ir':'Simulated IR','bags':'Luggage','detected':'Detected people','nothing_detected':'nothing detected',
  'no_people':'No people detected','formula':'people = 0.7 × YOLO + 0.3 × IR; wait = people × 30 s + luggage time',
  'nothing':'Nothing','updated':'Updated','margin':'Estimate includes allowance for additional screening',
  'Fluent':'Free-flowing','Moderat':'Moderate','Aglomerat':'Busy',
  'person':'Person','backpack':'Backpack','suitcase':'Suitcase','laptop':'Laptop','handbag':'Handbag',
 }
}
