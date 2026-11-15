import type { MissionWindow } from "../types";

// Real records from NASA DONKI (https://ccmc.gsfc.nasa.gov/DONKI/), fetched via the public DONKI web service
// (FLR / CME / GST / SEP). Raw JSON proofs are in moon/data/raw/. One entry per game day; QUIET = no notable event logged.
// Game effects (shield/comms) are our own simplification of the severity.
export const WINDOWS: MissionWindow[] = [
  {
    "id": "may-2024",
    "name": "May 2024 — the Gannon Superstorm",
    "blurb": "Sunspot group AR 3664 (13664) erupts again and again. On 10–11 May the strongest geomagnetic storm in two decades hits Earth, and the Moon outpost is wide open to it.",
    "days": [
      {
        "id": "2024-05-01T14:37:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-01T14:37Z",
        "magnitude": "M1.9",
        "title": "Strong solar flare (M1.9)",
        "text": "An M-class flare from AR 13654: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30394/-1",
          "detail": "FLR 2024-05-01T14:37Z · class M1.9 · AR 13654"
        }
      },
      {
        "id": "2024-05-02T15:00:00-GST-001",
        "kind": "GST",
        "time": "2024-05-02T15:00Z",
        "magnitude": "Kp 6.7",
        "title": "Geomagnetic storm (G2, Kp 6.7)",
        "text": "The solar wind shakes Earth's magnetic field: a G2 (moderate) storm, Kp 6.7 out of 9. The Moon has no magnetic field of its own, so the outpost is fully exposed and radio signals to Earth get noisy.",
        "severity": 2,
        "effect": {
          "shield": -10,
          "comms": -15
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/30399/-1",
          "detail": "GST 2024-05-02T15:00Z · Kp 6.67 · NOAA G2"
        }
      },
      {
        "id": "2024-05-03T02:11:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-03T02:11Z",
        "magnitude": "X1.6",
        "title": "Giant solar flare (X1.6)!",
        "text": "The Sun flashes an X-class flare (AR 13663). Light and X-rays arrive in 8 minutes; energetic particles may come minutes to hours later.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30403/-1",
          "detail": "FLR 2024-05-03T02:11Z · class X1.6 · AR 13663"
        }
      },
      {
        "id": "2024-05-04T06:02:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-04T06:02Z",
        "magnitude": "M9.1",
        "title": "Strong solar flare (M9.1)",
        "text": "M-class flare (M9.1) from AR 13663. Light arrives in ~8 minutes, so there is almost no warning for the outpost.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30424/-1",
          "detail": "FLR 2024-05-04T06:02Z · class M9.1 · AR 13663"
        }
      },
      {
        "id": "2024-05-05T05:47:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-05T05:47Z",
        "magnitude": "X1.3",
        "title": "Giant solar flare (X1.3)!",
        "text": "X-class flare! Its light needs only ~8 minutes to cross space. The outpost has no magnetic field or thick air to help, so the radiation shield takes a big hit.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30457/-1",
          "detail": "FLR 2024-05-05T05:47Z · class X1.3 · AR 13663"
        }
      },
      {
        "id": "2024-05-06T05:38:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-06T05:38Z",
        "magnitude": "X4.5",
        "title": "Giant solar flare (X4.5)!",
        "text": "The Sun flashes an X-class flare (AR 13663). Light and X-rays arrive in 8 minutes; energetic particles may come minutes to hours later.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30484/-1",
          "detail": "FLR 2024-05-06T05:38Z · class X4.5 · AR 13663"
        }
      },
      {
        "id": "2024-05-07T16:21:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-07T16:21Z",
        "magnitude": "M8.2",
        "title": "Strong solar flare (M8.2)",
        "text": "An M-class flare from AR 13663: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30532/-1",
          "detail": "FLR 2024-05-07T16:21Z · class M8.2 · AR 13663"
        }
      },
      {
        "id": "2024-05-08T01:33:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-08T01:33Z",
        "magnitude": "X1.0",
        "title": "Giant solar flare (X1.0)!",
        "text": "X-class flare! Its light needs only ~8 minutes to cross space. The outpost has no magnetic field or thick air to help, so the radiation shield takes a big hit.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30548/-1",
          "detail": "FLR 2024-05-08T01:33Z · class X1.0 · AR 13663"
        }
      },
      {
        "id": "2024-05-09T13:59:00-SEP-001",
        "kind": "SEP",
        "time": "2024-05-09T13:59Z",
        "magnitude": "SEP",
        "title": "Radiation storm! (solar energetic particles)",
        "text": "A flare from AR 3664 has launched fast protons (SEP). They reach the Moon within tens of minutes to hours. Time to head for the shelter!",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/30609/-1",
          "detail": "SEP 2024-05-09T13:59Z · MODEL: REleASE:ACE/EPAM 15.8-39.8 MeV"
        }
      },
      {
        "id": "2024-05-10T15:00:00-GST-001",
        "kind": "GST",
        "time": "2024-05-10T15:00Z",
        "magnitude": "Kp 9",
        "title": "Geomagnetic storm: extreme (G5)!",
        "text": "The solar wind shakes Earth's magnetic field: a G5 (extreme) storm, Kp 9.0 out of 9. The Moon has no magnetic field of its own, so the outpost is fully exposed and radio signals to Earth get noisy.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -15
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/30693/-1",
          "detail": "GST 2024-05-10T15:00Z · Kp 9.00 · NOAA G5"
        }
      },
      {
        "id": "2024-05-11T01:10:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-11T01:10Z",
        "magnitude": "X5.8",
        "title": "Giant solar flare (X5.8)!",
        "text": "X-class flare! Its light needs only ~8 minutes to cross space. The outpost has no magnetic field or thick air to help, so the radiation shield takes a big hit.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30711/-1",
          "detail": "FLR 2024-05-11T01:10Z · class X5.8 · AR 13664"
        }
      },
      {
        "id": "2024-05-12T16:11:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-12T16:11Z",
        "magnitude": "X1.0",
        "title": "Giant solar flare (X1.0)!",
        "text": "The Sun flashes an X-class flare (AR 13664). Light and X-rays arrive in 8 minutes; energetic particles may come minutes to hours later.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30760/-1",
          "detail": "FLR 2024-05-12T16:11Z · class X1.0 · AR 13664"
        }
      },
      {
        "id": "2024-05-13T12:44:00-SEP-001",
        "kind": "SEP",
        "time": "2024-05-13T12:44Z",
        "magnitude": "SEP",
        "title": "Radiation storm! (solar energetic particles)",
        "text": "Fast protons from the Sun race to the Moon within tens of minutes to hours. Unlike light they are bits of matter, and they can damage cells. Time to head for the shelter!",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/30811/-1",
          "detail": "SEP 2024-05-13T12:44Z · STEREO A: IMPACT 13-100 MeV"
        }
      },
      {
        "id": "2024-05-14T16:46:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-14T16:46Z",
        "magnitude": "X8.7",
        "title": "Giant solar flare (X8.7)!",
        "text": "X8.7: the biggest flare of this storm series. Its light and X-rays hit the Moon in about 8 minutes. A fast cloud (CME) leaves at the same time and heads toward Earth.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30849/-1",
          "detail": "FLR 2024-05-14T16:46Z · class X8.7 · AR 13664"
        }
      },
      {
        "id": "2024-05-15T08:18:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-15T08:18Z",
        "magnitude": "X3.4",
        "title": "Giant solar flare (X3.4)!",
        "text": "The Sun flashes an X-class flare (AR 13664). Light and X-rays arrive in 8 minutes; energetic particles may come minutes to hours later.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30879/-1",
          "detail": "FLR 2024-05-15T08:18Z · class X3.4 · AR 13664"
        }
      },
      {
        "id": "2024-05-16T13:38:00-CME-001",
        "kind": "CME",
        "time": "2024-05-16T13:38Z",
        "magnitude": "1452 km/s",
        "title": "Huge solar cloud (CME) at 1,452 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 1,452 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 29 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/30936/-1",
          "detail": "CME 2024-05-16T13:38Z · speed 1452 km/s · AR 13664"
        }
      },
      {
        "id": "2024-05-17T12:48:00-CME-001",
        "kind": "CME",
        "time": "2024-05-17T12:48Z",
        "magnitude": "1625 km/s",
        "title": "Huge solar cloud (CME) at 1,625 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 1,625 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 26 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/30974/-1",
          "detail": "CME 2024-05-17T12:48Z · speed 1625 km/s · source: location not given"
        }
      },
      {
        "id": "2024-05-18T13:38:00-CME-001",
        "kind": "CME",
        "time": "2024-05-18T13:38Z",
        "magnitude": "1585 km/s",
        "title": "Huge solar cloud (CME) at 1,585 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 1,585 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 26 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/31018/-1",
          "detail": "CME 2024-05-18T13:38Z · speed 1585 km/s · source: location not given"
        }
      },
      {
        "id": "2024-05-19T17:47:00-FLR-001",
        "kind": "FLR",
        "time": "2024-05-19T17:47Z",
        "magnitude": "M2.5",
        "title": "Strong solar flare (M2.5)",
        "text": "An M-class flare from AR 13685: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/31021/-1",
          "detail": "FLR 2024-05-19T17:47Z · class M2.5 · AR 13685"
        }
      },
      {
        "id": "2024-05-20T05:36:00-CME-001",
        "kind": "CME",
        "time": "2024-05-20T05:36Z",
        "magnitude": "2678 km/s",
        "title": "Huge solar cloud (CME) at 2,678 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 2,678 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 16 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/31034/-1",
          "detail": "CME 2024-05-20T05:36Z · speed 2678 km/s · source: location not given"
        }
      }
    ]
  },
  {
    "id": "sep-2017",
    "name": "September 2017 — the X9.3 Flare",
    "blurb": "A big sunspot (AR 2673 / 12673) wakes up late in the solar cycle. The X9.3 flare on 6 Sep is the strongest of the cycle, and the 10 Sep particle storm was even measured on the surface of Mars by the Curiosity rover.",
    "days": [
      {
        "id": "QUIET-2017-08-28",
        "kind": "QUIET",
        "time": "2017-08-28T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "No flares, no clouds, no radiation storms. Tobish can take a walk on the dusty surface.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-08-28"
        }
      },
      {
        "id": "QUIET-2017-08-29",
        "kind": "QUIET",
        "time": "2017-08-29T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "A peaceful day: the Sun is quiet and the outpost can focus on building.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-08-29"
        }
      },
      {
        "id": "QUIET-2017-08-30",
        "kind": "QUIET",
        "time": "2017-08-30T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "Space weather is calm. Time to charge batteries, grow plants and look at Earth in the sky.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-08-30"
        }
      },
      {
        "id": "QUIET-2017-08-31",
        "kind": "QUIET",
        "time": "2017-08-31T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "Nothing big from the Sun today. Even the Moon's dust seems to relax.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-08-31"
        }
      },
      {
        "id": "QUIET-2017-09-01",
        "kind": "QUIET",
        "time": "2017-09-01T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "All quiet on the Sun! A good day for science.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-09-01"
        }
      },
      {
        "id": "2017-09-02T15:23:00-FLR-001",
        "kind": "FLR",
        "time": "2017-09-02T15:23Z",
        "magnitude": "C7.7",
        "title": "Small solar flare (C7.7)",
        "text": "A small C-class flare (C7.7) from no numbered region. Light from it reaches the Moon in about 8 minutes, but this one is weak. The shield only loses a little.",
        "severity": 1,
        "effect": {
          "shield": -5
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/12965/-1",
          "detail": "FLR 2017-09-02T15:23Z · class C7.7 · no numbered region"
        }
      },
      {
        "id": "QUIET-2017-09-03",
        "kind": "QUIET",
        "time": "2017-09-03T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "No flares, no clouds, no radiation storms. Tobish can take a walk on the dusty surface.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-09-03"
        }
      },
      {
        "id": "2017-09-04T22:56:00-SEP-001",
        "kind": "SEP",
        "time": "2017-09-04T22:56Z",
        "magnitude": "SEP",
        "title": "Radiation storm! (solar energetic particles)",
        "text": "Fast protons from the Sun race to the Moon within tens of minutes to hours. Unlike light they are bits of matter, and they can damage cells. Time to head for the shelter!",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/13004/-1",
          "detail": "SEP 2017-09-04T22:56Z · MODEL: REleASE:SOHO/EPHIN 15.8-39.8 MeV"
        }
      },
      {
        "id": "2017-09-05T00:30:00-SEP-001",
        "kind": "SEP",
        "time": "2017-09-05T00:30Z",
        "magnitude": "SEP",
        "title": "Radiation storm! (solar energetic particles)",
        "text": "Fast protons from the Sun race to the Moon within tens of minutes to hours. Unlike light they are bits of matter, and they can damage cells. Time to head for the shelter!",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/12984/-1",
          "detail": "SEP 2017-09-05T00:30Z · GOES13: SEM/EPS >10 MeV"
        }
      },
      {
        "id": "2017-09-06T11:53:00-FLR-001",
        "kind": "FLR",
        "time": "2017-09-06T11:53Z",
        "magnitude": "X9.3",
        "title": "Giant solar flare (X9.3)!",
        "text": "X9.3: the strongest flare of the whole 2017 cycle. X-rays arrive in 8 minutes; a fast cloud (CME, 1,881 km/s) follows. The outpost has no air or magnetic field to help.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/13010/-1",
          "detail": "FLR 2017-09-06T11:53Z · class X9.3 · AR 12673"
        }
      },
      {
        "id": "2017-09-07T21:00:00-GST-001",
        "kind": "GST",
        "time": "2017-09-07T21:00Z",
        "magnitude": "Kp 8",
        "title": "Geomagnetic storm: severe (G4)!",
        "text": "The solar wind shakes Earth's magnetic field: a G4 (severe) storm, Kp 8.0 out of 9. The Moon has no magnetic field of its own, so the outpost is fully exposed and radio signals to Earth get noisy.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -15
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/13054/-1",
          "detail": "GST 2017-09-07T21:00Z · Kp 8.00 · NOAA G4"
        }
      },
      {
        "id": "2017-09-08T12:00:00-GST-001",
        "kind": "GST",
        "time": "2017-09-08T12:00Z",
        "magnitude": "Kp 8",
        "title": "Geomagnetic storm: severe (G4)!",
        "text": "The solar wind shakes Earth's magnetic field: a G4 (severe) storm, Kp 8.0 out of 9. The Moon has no magnetic field of its own, so the outpost is fully exposed and radio signals to Earth get noisy.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -15
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/13066/-1",
          "detail": "GST 2017-09-08T12:00Z · Kp 8.00 · NOAA G4"
        }
      },
      {
        "id": "2017-09-09T10:51:00-FLR-001",
        "kind": "FLR",
        "time": "2017-09-09T10:51Z",
        "magnitude": "M3.7",
        "title": "Strong solar flare (M3.7)",
        "text": "An M-class flare from AR 12673: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/13087/-1",
          "detail": "FLR 2017-09-09T10:51Z · class M3.7 · AR 12673"
        }
      },
      {
        "id": "2017-09-10T16:25:00-SEP-001",
        "kind": "SEP",
        "time": "2017-09-10T16:25Z",
        "magnitude": "SEP",
        "title": "Radiation storm! (solar energetic particles)",
        "text": "The X8.2 flare of 10 Sep fires fast protons straight at us (SEP). The same storm was measured on the surface of Mars by the Curiosity rover's RAD instrument. On the Moon there is no air: get to the shelter!",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/13101/-1",
          "detail": "SEP 2017-09-10T16:25Z · GOES13: SEM/EPS >100 MeV"
        }
      },
      {
        "id": "QUIET-2017-09-11",
        "kind": "QUIET",
        "time": "2017-09-11T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "Space weather is calm. Time to charge batteries, grow plants and look at Earth in the sky.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-09-11"
        }
      },
      {
        "id": "QUIET-2017-09-12",
        "kind": "QUIET",
        "time": "2017-09-12T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "Nothing big from the Sun today. Even the Moon's dust seems to relax.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-09-12"
        }
      },
      {
        "id": "2017-09-13T05:33:00-SEP-001",
        "kind": "SEP",
        "time": "2017-09-13T05:33Z",
        "magnitude": "SEP",
        "title": "Radiation storm! (solar energetic particles)",
        "text": "Fast protons from the Sun race to the Moon within tens of minutes to hours. Unlike light they are bits of matter, and they can damage cells. Time to head for the shelter!",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/13134/-1",
          "detail": "SEP 2017-09-13T05:33Z · STEREO A: IMPACT 13-100 MeV"
        }
      },
      {
        "id": "2017-09-14T15:00:00-GST-001",
        "kind": "GST",
        "time": "2017-09-14T15:00Z",
        "magnitude": "Kp 6",
        "title": "Geomagnetic storm (G2, Kp 6.0)",
        "text": "The solar wind shakes Earth's magnetic field: a G2 (moderate) storm, Kp 6.0 out of 9. The Moon has no magnetic field of its own, so the outpost is fully exposed and radio signals to Earth get noisy.",
        "severity": 2,
        "effect": {
          "shield": -10,
          "comms": -15
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/13150/-1",
          "detail": "GST 2017-09-14T15:00Z · Kp 6.00 · NOAA G2"
        }
      },
      {
        "id": "QUIET-2017-09-15",
        "kind": "QUIET",
        "time": "2017-09-15T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "No flares, no clouds, no radiation storms. Tobish can take a walk on the dusty surface.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-09-15"
        }
      },
      {
        "id": "QUIET-2017-09-16",
        "kind": "QUIET",
        "time": "2017-09-16T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "A peaceful day: the Sun is quiet and the outpost can focus on building.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2017-09-16"
        }
      }
    ]
  },
  {
    "id": "oct-2024",
    "name": "October 2024 — the X9.0 Flare",
    "blurb": "The Sun is near its 'solar maximum'. An X9.0 flare on 3 Oct is the strongest of the year, then another flare and a fast cloud on 9 Oct bring a severe G4 storm on 10 Oct.",
    "days": [
      {
        "id": "2024-09-26T22:58:00-FLR-001",
        "kind": "FLR",
        "time": "2024-09-26T22:58Z",
        "magnitude": "M1.4",
        "title": "Strong solar flare (M1.4)",
        "text": "An M-class flare from AR 13839: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33582/-1",
          "detail": "FLR 2024-09-26T22:58Z · class M1.4 · AR 13839"
        }
      },
      {
        "id": "QUIET-2024-09-27",
        "kind": "QUIET",
        "time": "2024-09-27T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "Space weather is calm. Time to charge batteries, grow plants and look at Earth in the sky.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2024-09-27"
        }
      },
      {
        "id": "QUIET-2024-09-28",
        "kind": "QUIET",
        "time": "2024-09-28T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "Nothing big from the Sun today. Even the Moon's dust seems to relax.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2024-09-28"
        }
      },
      {
        "id": "2024-09-29T06:00:00-CME-001",
        "kind": "CME",
        "time": "2024-09-29T06:00Z",
        "magnitude": "1148 km/s",
        "title": "Huge solar cloud (CME) at 1,148 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 1,148 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 36 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/33608/-1",
          "detail": "CME 2024-09-29T06:00Z · speed 1148 km/s · AR 13834"
        }
      },
      {
        "id": "2024-09-30T16:12:00-CME-001",
        "kind": "CME",
        "time": "2024-09-30T16:12Z",
        "magnitude": "1535 km/s",
        "title": "Huge solar cloud (CME) at 1,535 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 1,535 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 27 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/33634/-1",
          "detail": "CME 2024-09-30T16:12Z · speed 1535 km/s · AR 13834"
        }
      },
      {
        "id": "2024-10-01T21:58:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-01T21:58Z",
        "magnitude": "X7.1",
        "title": "Giant solar flare (X7.1)!",
        "text": "The Sun flashes an X-class flare (AR 13842). Light and X-rays arrive in 8 minutes; energetic particles may come minutes to hours later.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33656/-1",
          "detail": "FLR 2024-10-01T21:58Z · class X7.1 · AR 13842"
        }
      },
      {
        "id": "2024-10-02T05:30:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-02T05:30Z",
        "magnitude": "M3.6",
        "title": "Strong solar flare (M3.6)",
        "text": "An M-class flare from AR 13842: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33670/-1",
          "detail": "FLR 2024-10-02T05:30Z · class M3.6 · AR 13842"
        }
      },
      {
        "id": "2024-10-03T12:08:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-03T12:08Z",
        "magnitude": "X9.0",
        "title": "Giant solar flare (X9.0)!",
        "text": "X9.0: the strongest flare of 2024. Light and X-rays reach the Moon in about 8 minutes, and the outpost has no air to block them.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33693/-1",
          "detail": "FLR 2024-10-03T12:08Z · class X9.0 · AR 13842"
        }
      },
      {
        "id": "2024-10-04T04:36:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-04T04:36Z",
        "magnitude": "M4.0",
        "title": "Strong solar flare (M4.0)",
        "text": "An M-class flare from AR 13842: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33740/-1",
          "detail": "FLR 2024-10-04T04:36Z · class M4.0 · AR 13842"
        }
      },
      {
        "id": "2024-10-05T23:10:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-05T23:10Z",
        "magnitude": "M2.4",
        "title": "Strong solar flare (M2.4)",
        "text": "M-class flare (M2.4) from AR 13842. Light arrives in ~8 minutes, so there is almost no warning for the outpost.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33790/-1",
          "detail": "FLR 2024-10-05T23:10Z · class M2.4 · AR 13842"
        }
      },
      {
        "id": "2024-10-06T20:52:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-06T20:52Z",
        "magnitude": "M1.5",
        "title": "Strong solar flare (M1.5)",
        "text": "An M-class flare from AR 13842: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33809/-1",
          "detail": "FLR 2024-10-06T20:52Z · class M1.5 · AR 13842"
        }
      },
      {
        "id": "2024-10-07T19:02:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-07T19:02Z",
        "magnitude": "X2.1",
        "title": "Giant solar flare (X2.1)!",
        "text": "The Sun flashes an X-class flare (AR 13842). Light and X-rays arrive in 8 minutes; energetic particles may come minutes to hours later.",
        "severity": 3,
        "effect": {
          "shield": -18
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33824/-1",
          "detail": "FLR 2024-10-07T19:02Z · class X2.1 · AR 13842"
        }
      },
      {
        "id": "2024-10-08T06:12:00-CME-001",
        "kind": "CME",
        "time": "2024-10-08T06:12Z",
        "magnitude": "1124 km/s",
        "title": "Huge solar cloud (CME) at 1,124 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 1,124 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 37 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/33844/-1",
          "detail": "CME 2024-10-08T06:12Z · speed 1124 km/s · source: location not given"
        }
      },
      {
        "id": "2024-10-09T02:12:00-CME-001",
        "kind": "CME",
        "time": "2024-10-09T02:12Z",
        "magnitude": "2112 km/s",
        "title": "Huge solar cloud (CME) at 2,112 km/s!",
        "text": "After an X1.8 flare, the Sun launches a giant cloud at ~2,112 km/s. It reaches Earth's area in about a day and will cause a severe G4 storm on 10 October. The Moon has no magnetic field to help.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/33873/-1",
          "detail": "CME 2024-10-09T02:12Z · speed 2112 km/s · AR 13848"
        }
      },
      {
        "id": "2024-10-10T15:00:00-GST-001",
        "kind": "GST",
        "time": "2024-10-10T15:00Z",
        "magnitude": "Kp 8.7",
        "title": "Geomagnetic storm: severe (G4)!",
        "text": "The solar wind shakes Earth's magnetic field: a G4 (severe) storm, Kp 8.7 out of 9. The Moon has no magnetic field of its own, so the outpost is fully exposed and radio signals to Earth get noisy.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -15
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/33913/-1",
          "detail": "GST 2024-10-10T15:00Z · Kp 8.67 · NOAA G4"
        }
      },
      {
        "id": "2024-10-11T16:07:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-11T16:07Z",
        "magnitude": "M2.1",
        "title": "Strong solar flare (M2.1)",
        "text": "M-class flare (M2.1) from AR 13852. Light arrives in ~8 minutes, so there is almost no warning for the outpost.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33941/-1",
          "detail": "FLR 2024-10-11T16:07Z · class M2.1 · AR 13852"
        }
      },
      {
        "id": "QUIET-2024-10-12",
        "kind": "QUIET",
        "time": "2024-10-12T00:00Z",
        "magnitude": "calm",
        "title": "Quiet Sun",
        "text": "The Sun is calm today — great day to work outside.",
        "severity": 0,
        "effect": {},
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/",
          "detail": "No M/X-class flare, fast CME, geomagnetic storm or SEP logged on 2024-10-12"
        }
      },
      {
        "id": "2024-10-13T01:36:00-CME-001",
        "kind": "CME",
        "time": "2024-10-13T01:36Z",
        "magnitude": "1184 km/s",
        "title": "Huge solar cloud (CME) at 1,184 km/s!",
        "text": "The Sun throws out a giant cloud of charged gas at about 1,184 km/s. Travelling that fast it would cross the ~150 million km to the Earth–Moon area in roughly 35 hours. Radio signals and shields feel it.",
        "severity": 3,
        "effect": {
          "shield": -18,
          "comms": -8
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/33967/-1",
          "detail": "CME 2024-10-13T01:36Z · speed 1184 km/s · source: location not given"
        }
      },
      {
        "id": "2024-10-14T00:04:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-14T00:04Z",
        "magnitude": "M3.4",
        "title": "Strong solar flare (M3.4)",
        "text": "An M-class flare from AR 13848: a flash of X-rays that reaches the Moon in about 8 minutes. Medium size, but the Moon has no air to soften it.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33976/-1",
          "detail": "FLR 2024-10-14T00:04Z · class M3.4 · AR 13848"
        }
      },
      {
        "id": "2024-10-15T18:28:00-FLR-001",
        "kind": "FLR",
        "time": "2024-10-15T18:28Z",
        "magnitude": "M2.1",
        "title": "Strong solar flare (M2.1)",
        "text": "M-class flare (M2.1) from AR 13854. Light arrives in ~8 minutes, so there is almost no warning for the outpost.",
        "severity": 2,
        "effect": {
          "shield": -10
        },
        "source": {
          "name": "NASA DONKI",
          "url": "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/34008/-1",
          "detail": "FLR 2024-10-15T18:28Z · class M2.1 · AR 13854"
        }
      }
    ]
  }
];
