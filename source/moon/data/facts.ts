import type { ResKey, Source } from "../types";

/** Shown on the "mission failed" screen: why the outpost failed + the real-world lesson. */
export const FAIL_LESSONS: Record<ResKey, { why: string; lesson: string }> = {
  oxygen: {
    why: "The oxygen ran out. Nobody can breathe on the Moon without a sealed habitat that makes fresh oxygen and removes carbon dioxide.",
    lesson:
      "One astronaut uses about 0.9 kg of oxygen every day (NASA BVAD), and the Moon has no air to borrow from. Life-support systems split water into oxygen and recycle the air, and they must never stop.",
  },
  energy: {
    why: "The power ran out. Without electricity the air machines, heaters and radio all went silent in the cold lunar night.",
    lesson:
      "A lunar night lasts about 14.75 Earth days and the surface drops to around -170 C. Bases need big batteries, sunny spots like the polar ridges, or other power sources, so energy never hits zero.",
  },
  shield: {
    why: "The radiation shield was gone. Solar storms and cosmic rays hit Tobish with nothing in the way.",
    lesson:
      "The Moon has no thick air or magnetic field. Chang'e-4 measured about 1.37 mSv per day on the surface, around 200 times more than on Earth. Real crews would shelter under regolith or water and watch NASA's DONKI space-weather alerts.",
  },
  food: {
    why: "The food ran out. A crew needs a steady supply of calories, and the greenhouse could not keep up.",
    lesson:
      "Each astronaut eats about 0.8 kg of dry food a day (NASA BVAD). Experiments like Veggie and the Advanced Plant Habitat on the space station show that growing crops is possible, but it takes careful planning.",
  },
  comms: {
    why: "The link to Earth was lost. Without radio, Mission Control could not warn Tobish or help him.",
    lesson:
      "Radio takes about 1.28 seconds to reach the Moon, and NASA's Deep Space Network keeps three antenna sites around Earth so one always has a view. Solar storms can add noise, and the far side of the Moon needs a relay satellite.",
  },
};

/** Datasets and documents the game uses. Shown as a credits list on the end screen. */
export const SOURCES: Record<string, Source> = {
  donki: {
    name: "NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)",
    url: "https://ccmc.gsfc.nasa.gov/DONKI/",
    detail: "Real flares (FLR), CMEs, geomagnetic storms (GST) and SEPs for May 2024, Sep 2017 and Sep-Oct 2024",
  },
  msl_rad: {
    name: "MSL RAD (PDS Planetary Plasma Interactions node)",
    url: "https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/",
    detail: "Curiosity rover radiation data; Hassler et al. 2014, Science 343 (doi:10.1126/science.1244797)",
  },
  change4: {
    name: "Chang'e-4 LND, Zhang et al. 2020, Science Advances",
    url: "https://doi.org/10.1126/sciadv.aaz1334",
    detail: "First radiation dose measurements on the lunar surface: 1.37 mSv/day",
  },
  trek: {
    name: "NASA Moon Trek",
    url: "https://trek.nasa.gov/moon/",
    detail: "LRO LOLA and Diviner maps: topography, illumination, temperature, Shackleton crater",
  },
  osdr: {
    name: "NASA Open Science Data Repository (OSDR)",
    url: "https://osdr.nasa.gov/bio/",
    detail: "Space biology and plant-growth experiments (Veggie, Advanced Plant Habitat), bone and muscle research",
  },
  bvad: {
    name: "NASA NTRS 20210024855: Life Support Baseline Values and Assumptions Document (BVAD)",
    url: "https://ntrs.nasa.gov/citations/20210024855",
    detail: "Ewert, Chen & Powell, NASA/TP-20210024855: oxygen, CO2, water and food per astronaut per day",
  },
  dsn: {
    name: "NASA Deep Space Network",
    url: "https://deepspace.jpl.nasa.gov/",
    detail: "Goldstone, Madrid and Canberra antenna complexes",
  },
  paul2022: {
    name: "Paul et al. 2022, Communications Biology",
    url: "https://www.nature.com/articles/s42003-022-03334-8",
    detail: "Plants grown in real Apollo lunar regolith",
  },
  images: {
    name: "NASA Image and Video Library",
    url: "https://images.nasa.gov/",
    detail: "All photos are NASA public-domain images (SDO, ISS, Apollo, Artemis, JPL, LRO)",
  },
  solar_constant: {
    name: "NASA SORCE / TSIS total solar irradiance",
    url: "https://lasp.colorado.edu/home/sorce/data/tsi-data/",
    detail: "Solar constant of about 1,361 W/m2",
  },
};
