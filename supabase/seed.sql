-- Seed a starter parts catalogue so the Log-a-Mod autocomplete has content
-- from day one. These are popular AU 4WD parts; the moderation queue is
-- intentionally bypassed for seeded rows (source='wired', is_approved=true).
--
-- Run with: `npx supabase db reset --linked` (rebuilds + seeds)
--          or paste this file into the SQL editor.

insert into public.parts (brand, name, category, price_min, price_max, source, is_approved, install_difficulty)
values
  -- Suspension
  ('Old Man Emu', 'BP-51 Bypass Shock (Front)',     'suspension', 750.00, 1100.00, 'wired', true, 'professional'),
  ('Old Man Emu', 'BP-51 Bypass Shock (Rear)',      'suspension', 750.00, 1100.00, 'wired', true, 'professional'),
  ('Tough Dog', 'Foam Cell Pro 35mm Lift Kit',      'suspension', 1500.00, 2400.00, 'wired', true, 'moderate'),
  ('Dobinsons', 'IMS Adjustable Strut',             'suspension', 600.00, 900.00, 'wired', true, 'moderate'),
  ('Ironman 4x4', 'Foam Cell Pro 2" Lift Kit',      'suspension', 1100.00, 1800.00, 'wired', true, 'moderate'),

  -- Wheels and tyres
  ('Cooper', 'STT Pro 285/70R17',                   'wheels_tyres', 470.00, 560.00, 'wired', true, 'easy'),
  ('BFGoodrich', 'KO2 285/70R17',                   'wheels_tyres', 460.00, 540.00, 'wired', true, 'easy'),
  ('Toyo', 'Open Country M/T 285/75R16',            'wheels_tyres', 480.00, 580.00, 'wired', true, 'easy'),
  ('Method Race Wheels', 'MR305 NV 17x8.5',         'wheels_tyres', 470.00, 580.00, 'wired', true, 'easy'),
  ('ROH', 'Trophy 17x8',                            'wheels_tyres', 280.00, 380.00, 'wired', true, 'easy'),

  -- Recovery
  ('Maxtrax', 'MKII Recovery Boards (Pair)',        'recovery',     320.00, 380.00, 'wired', true, 'easy'),
  ('Warn', 'Zeon 10-S Winch',                       'recovery',     2400.00, 2900.00, 'wired', true, 'professional'),
  ('Runva', 'EWX9500 Winch',                        'recovery',     900.00, 1300.00, 'wired', true, 'professional'),
  ('ARB', 'Snatch Strap 8000kg',                    'recovery',     90.00, 140.00, 'wired', true, 'easy'),

  -- Body
  ('ARB', 'Summit Bull Bar',                        'body',         2200.00, 2900.00, 'wired', true, 'professional'),
  ('TJM', 'Outback Bar',                            'body',         1800.00, 2500.00, 'wired', true, 'professional'),
  ('Rhino-Rack', 'Pioneer Platform 2128mm',         'body',         1400.00, 1700.00, 'wired', true, 'moderate'),
  ('Front Runner', 'Slimline II Rack 1255mm',       'body',         1200.00, 1600.00, 'wired', true, 'moderate'),
  ('Yakima', 'LockN''Load Platform',                'body',         900.00, 1200.00, 'wired', true, 'moderate'),

  -- Lighting
  ('Stedi', 'ST3303 22" Light Bar',                 'lighting',     600.00, 800.00, 'wired', true, 'moderate'),
  ('Lightforce', 'HTX2 Hybrid Driving Lights',      'lighting',     1200.00, 1500.00, 'wired', true, 'moderate'),
  ('Narva', 'Ultima 215 LED Driving Lights',        'lighting',     500.00, 700.00, 'wired', true, 'moderate'),

  -- Electrical
  ('REDARC', 'BCDC1240D DC-DC Charger',             'electrical',   500.00, 650.00, 'wired', true, 'professional'),
  ('Projecta', 'IDC25 DC-DC Charger',               'electrical',   300.00, 400.00, 'wired', true, 'professional'),
  ('Enerdrive', 'B-TEC 100Ah Lithium Battery',      'electrical',   1100.00, 1400.00, 'wired', true, 'professional'),
  ('GME', 'XRS-370C UHF Radio',                     'electrical',   500.00, 650.00, 'wired', true, 'moderate'),

  -- Drivetrain
  ('ARB', 'Air Locker (Rear)',                      'drivetrain',   1500.00, 1900.00, 'wired', true, 'professional'),
  ('Eaton', 'E-Locker (Rear)',                      'drivetrain',   1500.00, 1900.00, 'wired', true, 'professional'),

  -- Camping
  ('Darche', 'Panorama 2 Rooftop Tent',             'camping',      3200.00, 3900.00, 'wired', true, 'moderate'),
  ('23ZERO', 'Walkabout 87 Rooftop Tent',           'camping',      2400.00, 3000.00, 'wired', true, 'moderate'),

  -- Interior
  ('Black Duck', 'Canvas Seat Covers (Pair)',       'interior',     350.00, 550.00, 'wired', true, 'easy'),
  ('MSA 4x4', 'Drop-Down Fridge Slide',             'interior',     650.00, 850.00, 'wired', true, 'moderate')
on conflict do nothing;
