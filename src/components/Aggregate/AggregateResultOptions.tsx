import {
  AggregationAxis,
  AggregationInterval,
  Amcat,
  AggregationMetric,
} from "amcat4react";
import { getField } from "amcat4react/dist/Amcat";
import { DisplayOption, MetricFunction } from "amcat4react/dist/interfaces";
import React, { useState } from "react";
import { Button, Dropdown, Form, Icon } from "semantic-ui-react";
import { SemanticICONS } from "semantic-ui-react/dist/commonjs/generic";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { selectIndex } from "../Menu/LoginSlice";
import { selectQuery } from "../Query/QuerySlice";
import { selectOptions, setAggregationOptions } from "./AggregateSlice";
import "./Aggregation.scss";

const INTERVALS = ["day", "week", "month", "quarter", "year", "daypart", "dayofweek"];

const DISPLAY: {
  value: DisplayOption;
  text: string;
  icon: SemanticICONS;
}[] = [
  { value: "linechart", text: "Line Graph", icon: "line graph" },
  { value: "barchart", text: "Bar Chart", icon: "chart bar" },
  { value: "list", text: "List", icon: "list layout" },
  { value: "table", text: "Table", icon: "table" },
];

const aggregation_labels = {
  list: ["Group results by", "And then by", "Maximum number of rows"],
  table: ["Rows", "Columns", "(not used)"],
  linechart: [
    "Horizontal (X) axis",
    "Multiple lines",
    "Maximum number of lines",
  ],
  barchart: ["Create bars for", "Cluster bars by", "Maximum number of bars"],
};

export default function AggregateResultOptions() {
  const reduxOptions = useAppSelector(selectOptions) || {};
  const [options, setOptions] = useState(reduxOptions);
  const dispatch = useAppDispatch();
  function setDisplay(value: DisplayOption) {
    setOptions({ ...options, display: value });
  }
  function setAxis(i: number, newval?: AggregationAxis) {
    console.log(newval);
    const axes = options.axes == null ? [] : [...options.axes];
    if (newval == null) axes.splice(i, 1);
    else axes[i] = newval;
    setOptions({ ...options, axes });
  }
  function submit() {
    if (options != null) dispatch(setAggregationOptions(options));
  }
  const labels = aggregation_labels[options.display];
  const displayoptions = DISPLAY.map((d, i) => (
    <React.Fragment key={d.value}>
      {i === 0 ? null : <Button.Or key={"or_" + d.value} />}

      <Button
        key={d.value}
        active={d.value === options.display}
        toggle
        onClick={() => setDisplay(d.value)}
      >
        <Icon key={d.value} name={d.icon} />
        {d.text}
      </Button>
    </React.Fragment>
  ));

  return (
    <div className="aggregateoptions">
      <div className="aggregateoptionsrow">
        <div className="label">Display as</div>
        <div className="option">
          <Button.Group>{displayoptions}</Button.Group>
        </div>
      </div>
      <div className="aggregateoptionsrow">
        <div className="label">Aggregation</div>
        <div className="option">
          <MetricPicker
            value={options.metrics?.[0]}
            onChange={(newval) =>
              setOptions({
                ...options,
                metrics: newval == null ? undefined : [newval],
              })
            }
          />
        </div>
      </div>
      <div className="aggregateoptionsrow">
        <div className="label">{labels[0]}</div>
        <div className="option">
          <AxisPicker
            value={options.axes?.[0]}
            onChange={(newval) => setAxis(0, newval)}
          />
        </div>
      </div>
      <div className="aggregateoptionsrow">
        <div className="label">{labels[1]}</div>
        <div className="option">
          <AxisPicker
            value={options.axes?.[1]}
            onChange={(newval) => setAxis(1, newval)}
            clearable
          />
        </div>
      </div>

      <Button primary onClick={submit}>
        Submit
      </Button>
    </div>
  );
}

interface MetricPickerProps {
  value?: AggregationMetric;
  onChange: (value?: AggregationMetric) => void;
}
function MetricPicker({ value, onChange }: MetricPickerProps) {
  const index = useAppSelector(selectIndex);
  const fields = Amcat.useFields(index);
  if (fields == null) return null;
  const metricFieldOptions = fields
    .filter((f) => ["date", "double", "long"].includes(f.type))
    .map((f) => ({
      key: f.name,
      text: f.name,
      value: f.name,
      icon: f.type === "date" ? "calendar outline" : "sort numeric down",
    }));

  const metricFunctionOptions = ["avg", "min", "max", "sum"].map((f) => ({
    key: f,
    text: f,
    value: f,
  }));
  metricFunctionOptions.unshift({
    key: "_total",
    text: "Total count",
    value: "_total",
  });
  function setFunction(newval: string) {
    if (newval == "_total") return onChange(undefined);
    const result = { ...value, function: newval as MetricFunction };
    result.field ??= metricFieldOptions[0].value;
    onChange(result as AggregationMetric);
  }
  function setField(newval: string) {
    if (value != null) onChange({ ...value, field: newval });
  }
  return (
    <>
      <Dropdown
        placeholder="Aggregation function"
        selection
        options={metricFunctionOptions}
        label="Aggregation"
        value={value?.function || "_total"}
        onChange={(_e, { value }) => setFunction(value as string)}
      />
      {value?.function == null ? null : (
        <>
          <div className="midlabel">Field</div>
          <Dropdown
            placeholder="Aggregation field"
            selection
            options={metricFieldOptions}
            value={value?.field}
            onChange={(_e, { value }) => setField(value as string)}
          />
        </>
      )}
    </>
  );
}
interface AxisPickerProps {
  value?: AggregationAxis;
  onChange: (value?: AggregationAxis) => void;
  clearable?: boolean;
}
function AxisPicker({ value, onChange, clearable = false }: AxisPickerProps) {
  const index = useAppSelector(selectIndex);
  const query = useAppSelector(selectQuery);
  const fields = Amcat.useFields(index);
  const axes = useAppSelector(selectOptions).axes || [];

  const fieldoptions = fields
    .filter((f) => ["date", "keyword"].includes(f.type))
    .filter(
      // don't include 'other' field
      (f) =>
        f.name === value?.field || !axes.map((x) => x.field).includes(f.name)
    )
    .map((f) => ({
      text: f.name,
      value: f.name,
      key: f.name,
      icon: Amcat.getFieldTypeIcon(f.type),
    }));
  if (query.queries && query.queries.length > 1) {
    fieldoptions.unshift({
      text: "By query",
      value: "_query",
      key: "_query",
      icon: "text cursor",
    });
  }
  function setField(field: string) {
    if (field == null || field === "") {
      onChange(undefined);
    } else {
      const result: AggregationAxis = { ...value, field: field };
      const ftype = field == "_query" ? "_query" : getField(fields, field).type;
      result.field = field;
      if (ftype !== "date") delete result.interval;
      else if (result.interval == null) result.interval = "day";
      onChange(result);
    }
  }
  function setInterval(interval: AggregationInterval) {
    // Cannot set interval without field
    if (value != null) onChange({ ...value, interval });
  }

  const field = value && Amcat.getField(fields, value.field);
  const intervaloptions =
    field?.type === "date" &&
    INTERVALS.map((i) => ({ key: i, text: i, value: i }));

  return (
    <>
      <Dropdown
        selection
        clearable={clearable}
        options={fieldoptions}
        value={value?.field}
        onChange={(_, { value }) => setField(value as string)}
      />
      {!intervaloptions ? null : (
        <React.Fragment>
          <div className="midlabel">Interval:</div>
          <Dropdown
            selection
            options={intervaloptions}
            value={value?.interval}
            onChange={(_, { value }) =>
              setInterval(value as AggregationInterval)
            }
          />
        </React.Fragment>
      )}
    </>
  );
}
