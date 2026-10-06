# After the Call

### Overview

I chose Greenpoint because I live here and have watched it develop so fast. I was curious about how that change might appear through something ordinary and imperfect, like noise complaints. I want to make a small interactive sandbox called "After the Call" that looks at how Greenpoint's visible pattern of 311 noise complaints might change when nighttime reporting changes. The project should always make clear that it models reports, not the actual amount of sound in the neighborhood.

### Data

Use the real files in `data/Original` and do not modify them. The main record is `greenpoint_noise_2015.json`, downloaded from the [NYC 311 Service Requests from 2010 to 2019 archive](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-2019/76ig-c548/about_data). It contains 2,425 noise-related service requests in incident ZIP 11222 from January 1 through December 31, 2015. One row is one request, not one sound event.

The fields I need are the unique request ID, created date and time, complaint type, latitude and longitude. Group the complaint types into Residential, Unspecified noise, Commercial, Street / sidewalk, Vehicle, Park and Other. The source totals should remain visible in the category menu: 874 Residential, 679 Unspecified noise, 388 Commercial, 240 Street / sidewalk, 201 Vehicle, 40 Park and 3 Other. The Other category contains two House of Worship rows and one Helicopter row.

Use `zip11222.geojson`, from the [NYC DOHMH Modified ZIP Code Tabulation Areas dataset](https://data.cityofnewyork.us/Health/Modified-Zip-Code-Tabulation-Areas-MODZCTA-/pri4-ifjk), only as geographic context. Keep all 2,425 source requests. If a recorded coordinate falls outside the MODZCTA outline, retain it and explain the mismatch rather than silently removing it.

### Objectives

I focused on nighttime reporting because sound is often experienced differently at night, especially when people are trying to sleep. At the same time, a 311 record only shows that someone decided to report a problem. I want visitors to see how changes in reporting behavior could change the apparent pattern of noise and the possible workload represented by the archive.

The main comparison should be the change in the expected number of reports over one week. The map support that comparison by showing where sampled source records appear, but it does not predict the exact locations of future noise. The page has its limitations, including that the data does not contain decibels, duration, unreported noise, caller identity, unequal access to 311, population change or an explanation of why a sound becomes unacceptable.

### Data prep - the rule

Create `prepare.py` to read the original files and write a compact processed JSON file to `data/Processed`. Keep every calendar day in 2015, including the nine days with zero qualifying requests. For every retained row, derive its calendar date, weekday, minute of day and display category. Embed only the fields needed by the sandbox in the final HTML.

For each target day, randomly borrow one complete day from 2015 with the same weekday. Each borrowed request keeps its original category, minute and recorded coordinate. This is a same-weekday empirical resampling rule: it reuses real observed days instead of inventing new locations or rows.

The main assumption is a night reporting multiplier, with no unit because it is a ratio. Its range should be 0.50 to 2.00 and its starting value should be 1.50. A value of 1.00 leaves sampled nighttime records unchanged; 0.50 means half as many are expected to remain; 1.50 means 50% more are expected. Apply the multiplier probabilistically by thinning nighttime records below 1.00 or repeating real source records above 1.00. The starting night window is 22:00 through 02:59. Both the multiplier and the night window are modeling assumptions, not measured coefficients, and should be labeled that way.

### The run

Run the sandbox from June 3 through June 9, 2030, in one-hour steps: 168 steps total. The 2030 week is a modeling choice used to place the record in a future time; the sandbox is a sensitivity study rather than a literal forecast of that week.

Repeat the seven-day sampling 100 times. Show the median hourly counts, the 10th–90th percentile band, the mean weekly total and the change from the baseline. Use a repeatable starting seed of 311 so the first result is reproducible. A button may change the seed to draw another set of seven historical days. All displayed locations must still come from real source rows.

### The interactive

Make one self-contained `index.html` with all styles, scripts and processed data inline. 

Put the controls in this order:

1. A clock that moves through the 168 hourly steps and can also play automatically.
2. Drawing choices: map or hourly chart, complaint category, point or glow marks, and a baseline comparison.
3. The night reporting multiplier, from 0.50 to 2.00, starting at 1.50.
4. Finer assumptions: the start and end of night, the percentile band and the option to draw another seven-day sample.

The map show the selected hour brightly and the previous six hours faintly, because individual categories can be sparse at an hourly scale. Purple represent sampled source records and orange should represent records changed by the nighttime assumption. The summary cards show changed weekly requests, difference from baseline, the current-hour count and the nighttime share.

I want the visual language to feel like a nighttime neighborhood archive rather than a standard dashboard: a dark background, muted purple records, restrained orange changes, Times New Roman type, thin archival lines and subtle filing details. The category filter is important because it lets visitors inspect different kinds of complaints separately. The explanation of what changes after the run should remain direct and easy to find.
