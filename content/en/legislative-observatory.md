---
title: "Visualizations"
summary: "Charted overview of laws and bills"
translationKey: observatory
---

## Laws and bills by country

{{< chart src="/charts/leyes_por_pais.svg" alt="Laws by country" >}}
{{< chart src="/charts/proyectos_por_pais.svg" alt="Bills by country" >}}
{{< chart src="/charts/leyes_vs_proyectos_por_pais.svg" alt="Laws vs bills by country" >}}

## Yearly trends

{{< chart src="/charts/tendencia_anual.svg" alt="Yearly trends" >}}

## Impact on speech

{{< chart src="/charts/impacto_leyes_por_pais.svg" alt="Impact on speech (laws)" >}}
{{< chart src="/charts/impacto_proyectos_por_pais.svg" alt="Impact on speech (bills)" >}}

## Legitimate objectives

{{< chart src="/charts/top_objetivos_leyes.svg" alt="Top legitimate objectives (laws)" >}}
{{< chart src="/charts/top_objetivos_proyectos.svg" alt="Top legitimate objectives (bills)" >}}

## Tripartite test

{{< chart src="/charts/tripartito_regional.svg" alt="Tripartite test compliance (regional)" >}}
{{< chart src="/charts/tripartito_leyes_por_pais.svg" alt="Tripartite test compliance (laws)" >}}
{{< chart src="/charts/tripartito_proyectos_por_pais.svg" alt="Tripartite test compliance (bills)" >}}

## Criminalization of expression

{{< chart src="/charts/criminaliza_regional.svg" alt="Laws that criminalize expression (regional)" >}}
{{< chart src="/charts/criminaliza_por_pais.svg" alt="Laws that criminalize expression (by country)" >}}

## Interactive

{{< vega spec="/charts/interactive/country_year_explorer.json" id="chart-country-year" title="Country/Year Explorer" >}}
{{< vega spec="/charts/interactive/objetivos_drilldown.json" id="chart-objetivos" title="Legitimate Objectives Distribution" >}}
