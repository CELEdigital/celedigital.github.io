---
title: "Visualizations"
summary: "Charted overview of laws and bills"
translationKey: observatory
---

## Laws and bills by country

{{< chartrow cols="3" >}}
{{< chartcol span="1" >}}{{< chart src="/charts/leyes_por_pais.svg" alt="Laws by country" >}}{{< /chartcol >}}
{{< chartcol span="1" >}}{{< chart src="/charts/proyectos_por_pais.svg" alt="Bills by country" >}}{{< /chartcol >}}
{{< chartcol span="1" >}}{{< chart src="/charts/leyes_vs_proyectos_por_pais.svg" alt="Laws vs bills by country" >}}{{< /chartcol >}}
{{< /chartrow >}}

## Yearly trends

{{< chartrow cols="1" >}}
{{< chartcol span="1" >}}{{< chart src="/charts/tendencia_anual.svg" alt="Yearly trends" >}}{{< /chartcol >}}
{{< /chartrow >}}

## Impact on speech

{{< chartrow cols="2" >}}
{{< chartcol span="1" >}}{{< chart src="/charts/impacto_leyes_por_pais.svg" alt="Impact on speech (laws)" >}}{{< /chartcol >}}
{{< chartcol span="1" >}}{{< chart src="/charts/impacto_proyectos_por_pais.svg" alt="Impact on speech (bills)" >}}{{< /chartcol >}}
{{< /chartrow >}}

## Legitimate objectives

{{< chartrow cols="2" >}}
{{< chartcol span="1" >}}{{< chart src="/charts/top_objetivos_leyes.svg" alt="Top legitimate objectives (laws)" >}}{{< /chartcol >}}
{{< chartcol span="1" >}}{{< chart src="/charts/top_objetivos_proyectos.svg" alt="Top legitimate objectives (bills)" >}}{{< /chartcol >}}
{{< /chartrow >}}

## Tripartite test

{{< chartrow cols="3" >}}
{{< chartcol span="1" >}}{{< chart src="/charts/tripartito_regional.svg" alt="Tripartite test compliance (regional)" >}}{{< /chartcol >}}
{{< chartcol span="1" >}}{{< chart src="/charts/tripartito_leyes_por_pais.svg" alt="Tripartite test compliance (laws)" >}}{{< /chartcol >}}
{{< chartcol span="1" >}}{{< chart src="/charts/tripartito_proyectos_por_pais.svg" alt="Tripartite test compliance (bills)" >}}{{< /chartcol >}}
{{< /chartrow >}}

## Criminalization of expression

{{< chartrow cols="2" >}}
{{< chartcol span="1" >}}{{< chart src="/charts/criminaliza_regional.svg" alt="Laws that criminalize expression (regional)" >}}{{< /chartcol >}}
{{< chartcol span="1" >}}{{< chart src="/charts/criminaliza_por_pais.svg" alt="Laws that criminalize expression (by country)" >}}{{< /chartcol >}}
{{< /chartrow >}}

## Interactive

{{< vega spec="/charts/interactive/country_year_explorer.json" id="chart-country-year" title="Country/Year Explorer" >}}
{{< vega spec="/charts/interactive/objetivos_drilldown.json" id="chart-objetivos" title="Legitimate Objectives Distribution" >}}
{{< vega spec="/charts/interactive/observatorio_drilldown.json" id="chart-observatorio-db" title="Multilevel Database Explorer" >}}
{{< vega spec="/charts/interactive/observatorio_sunburst.json" id="chart-observatorio-sunburst" title="Hierarchical Sunburst" >}}
{{< documentation interactive="true" sync="observatorio" >}}
