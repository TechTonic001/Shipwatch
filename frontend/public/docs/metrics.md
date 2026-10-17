# Shipwatch metric definitions

Deployment frequency is the number of successful production deployments per day in the selected UTC window.

Change failure rate is production deployments with final state failure or error divided by production deployments with final state success, failure, or error. A zero denominator is shown as no data.

MTTR is the median duration between incident opened and resolved timestamps for incidents resolved in the selected window. The p90 is shown as a secondary value.

The daily deployment chart includes successful production deployments only; the current metrics API does not return failed counts per day.
