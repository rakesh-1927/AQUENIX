# AQUENIX

**Smart Water & Groundwater Intelligence Platform**

Monitor Water. Understand Groundwater. Know Before You Drill.

AQUENIX is a browser-based hackathon prototype for farmers, village authorities and groundwater survey teams in India. It follows a village's water question from a warning on the dashboard to a site assessment, a conservation estimate and a new monthly reading.

## Open the demo

1. Extract the entire ZIP. Keep the `assets` folder next to `index.html`.
2. Double-click **index.html** inside the extracted AQUENIX folder. Use a recent version of Edge, Chrome, Firefox or Safari.
3. Start on **Overview**. The chart, sample records, regional map and assessments work offline. **OpenStreetMap** in the map selector adds street detail when an internet connection is available.

No install, sign-in, API key, build command or subscription is needed. Share the original ZIP to give another computer the clean four-site demo.

### Optional local server

For a repeatable browser storage address or a school computer with restrictions on local HTML files, open a terminal inside the extracted AQUENIX folder. With Python 3 installed, run the command for your computer.

**Windows**

```powershell
py -3 -m http.server 8000 --bind 127.0.0.1
```

**macOS or Linux**

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/**. Keep the terminal open during the demo. Press Ctrl+C to stop the server.

## A four-minute judging demo

| Time | What to do | What to say |
| --- | --- | --- |
| 0:00–0:35 | Open **Overview** and **Water Scarcity**. Point to Nagpur. | “Which village should a water officer visit first? Across four sample sites, two need attention. Nagpur's June depth is 22 metres and its rainfall is 110 mm against a 160 mm demo baseline.” |
| 0:35–1:05 | Open **Groundwater Monitoring** and choose **Gadchiroli**. Hover over May and June. | “In this sample, the water table moves from 18 metres below ground in May to 15 in June. That is a 3-metre recovery. Each point has a corresponding monthly record.” |
| 1:05–2:10 | Open **Smart Groundwater Intelligence**. Pick **Gadchiroli** under **Sample monitoring location**, then **Analyse Location**. Expand **How scoring works**. Search **New Delhi**, press **Find site**, then analyse again. | “Gadchiroli earns 5 out of 6 under our teaching rules. Delhi has no monitoring series here, so it receives Insufficient data. A coordinate cannot tell a farmer how much a well will yield. This report shows what a field specialist still needs to check.” |
| 2:10–2:45 | Open **Water Conservation**. Enter **100 m²**, **800 mm**, **0.8**, then **Calculate**. | “This roof could collect about 64,000 litres in a year before storage limits. That gives the village a practical option to discuss alongside groundwater monitoring.” |
| 2:45–3:45 | Open **Admin Panel**, select **Gadchiroli**, set **July 2026**, depth **14**, rainfall **180**, baseline **160**. Save. Return to **Overview** and then Gadchiroli's chart. | “The network's latest-site average changes from 16.5 m to 16.3 m. July's chart point is 14 m because only Gadchiroli has reported for July. A refresh keeps the entry.” |
| 3:45–4:00 | Return to a report, switch to the audience's language, then choose **Print report**. | “A farmer and a surveyor can take the same evidence summary into a field visit. Our next milestone is to pilot it against dated, verified local observations.” |

If someone else has already entered July, use **Edit** in the July row. To rehearse from the initial data, open the app in a fresh browser profile or a new private session. Close all private windows between rehearsals. Do the demonstration in one browser tab.

## What the numbers mean

- **Demonstration dataset.** Four city reference points have six fictional monthly readings each, January–June 2026. Rainfall values and rainfall baselines are sample inputs. Real cartographic features come from Natural Earth and the optional OpenStreetMap layer. No government monitoring feed is connected.
- **Dashboard.** Average depth uses the latest available reading from each measured site in the active filters. Depth change averages site changes with a reading in the immediately preceding calendar month. Rainfall status compares the mean of the latest available site rainfall-to-baseline ratios with 1. The chart uses the mean of reporting sites in each calendar month. A missing month stays blank.
- **Scarcity screening.** A site is High risk at a depth of at least 20 m or rainfall below 70% of its baseline. Watch starts at 16 m or rainfall below 85%. Other measured sites are Normal. Sites with no depth reading show No data. Missing rainfall does not contribute to screening. The network shows High risk if every measured site is high risk, Watch if any site is flagged, and Normal otherwise. These thresholds illustrate the software workflow.
- **Location assessment.** A click within 2 km of a sample station can use the nearest station's illustrative series. Elsewhere the result is Insufficient data. The 2 km radius is a teaching convention. Similar distances can span different aquifers.

| Factor | 0 points | 1 point | 2 points |
| --- | --- | --- | --- |
| Latest depth below ground | 20 m or deeper | 12 m to under 20 m | Under 12 m |
| Change from preceding calendar month | At least 1 m deeper | Less than 1 m change in either direction | At least 1 m shallower |
| Latest rainfall / positive monthly baseline | Below 0.75 | 0.75 to under 1 | 1 or above |

All three factors must be present before the demo calculates a score. Totals of 0, 1, 2–3, 4–5 and 6 map to Very low, Low, Moderate, High and Very high illustrative suitability. Every report identifies missing site-scale information, including rock formations, fractures, local drainage, terrain, water-body distances and measured well yields. Real drilling suitability remains undetermined. Local hydrogeological investigation is the appropriate next step. A stored borewell reference can appear as nearby context but contributes no points.

**Rainwater calculator.** One millimetre of rain over one square metre equals one litre. The result is catchment area × annual rainfall × runoff coefficient. Select a coefficient from 0 to 1 that reflects capture losses. Tank size and seasonal rainfall affect how much the household can actually store.

## Presenting and editing

- **Map controls.** Click a station on Overview to open its history. In site assessment, click the map, use the sample-site selector, search a listed city, or enter decimal coordinates in latitude, longitude order. The local gazetteer includes the four demo sites and ten additional cities. Any coordinate can be entered directly. The regional atlas is generalized at close zoom. Online street tiles are requested only when selected.
- **Administration.** The panel is open for the prototype. Add a location, save a new month, or edit an existing row. A site can have one reading per month. Enter a borewell only when you have checked its original record, date and coordinates. The seeded dataset contains zero borewell records.
- **Storage.** Readings, locations and user-referenced borewells stay in the current browser's local storage. Device changes, file moves, private sessions and different server addresses can create a fresh workspace. The ZIP transfers the code, maps and original sample data. Browser edits are specific to the browser where you made them.
- **Language and voice.** Use the top menu for English, Marathi, Hindi or Telugu. On an assessment report, **Read aloud** uses an installed voice for the selected language. When the device lacks a matching voice, use the on-screen guidance.
- **PDF.** Generate an assessment, choose **Print report**, then **Save as PDF** in the browser print dialog. The print layout contains the coordinates, data date, evidence, uncertainties and next steps.

| File | What your team can change |
| --- | --- |
| index.html | Application entry, document metadata and local asset loading |
| style.css | Colours, mobile layout, dashboard styling and printable report |
| script.js | Sample readings, navigation, charts, maps, scoring, forms and storage |
| assets/languages.js | Interface wording in Hindi, Marathi and Telugu |
| assets/india-map.js | Generalized Natural Earth geographic layers |
| assets/THIRD-PARTY.txt | Dependency versions, original sources and redistribution notices |

## References for the next stage

The prototype's numeric thresholds are authored for demonstration. The following references give background for investigating actual sites and designing conservation work.

- Geological and well records, field measurements and local tests inform an assessment of groundwater availability. [USGS, How Do Hydrologists Locate Groundwater?](https://www.usgs.gov/water-science-school/science/how-do-hydrologists-locate-groundwater)
- The Central Ground Water Board describes rooftop harvesting and a method for estimating the quantity collected. [CGWB, rooftop rainwater harvesting](https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1690373160632785309file.pdf)
- The offline map includes generalized land, state boundaries and rivers for regional orientation. [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/)
