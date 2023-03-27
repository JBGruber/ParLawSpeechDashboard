"use client";
import {
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  Typography,
} from "@mui/material";
import Grid2 from "@mui/material/Unstable_Grid2";
import { DatePicker } from "@mui/x-date-pickers";
import { debounce } from "lodash";
import moment from "moment";
import { useEffect, useState } from "react";
import Highlighter from "react-highlight-words";
import { useQuerySpeech } from "../api/useQuerySpeech";
import { DateFilterType } from "../modules/types";
import SpeechTable from "./SpeechTable";
import SpeechWordCloud from "./SpeechWordCloud";

type DetailedSpeechesProps = {
  dateFilter: DateFilterType;
  setDateFilter: (dateFilter: DateFilterType) => void;
  keywordInput: string[];
  isRegex: boolean;
  country: "AUT" | "GER";
};
export default function DetailedSpeeches({
  dateFilter,
  setDateFilter,
  keywordInput,
  isRegex,
  country,
}: DetailedSpeechesProps) {
  const [chosenSpeech, setChosenSpeech] = useState<number>(0);
  const [showWordCloud, setShowWordCloud] = useState<boolean>(false);
  const [page, setPage] = useState(0);
  const [highlightTfIdf, setHighlightTfIdf] = useState<boolean>(false);
  const { data: speeches, mutate: getSpeeches } = useQuerySpeech(
    "speeches_" + country.toLowerCase()
  );

  const handleSpeechesSearch = () => {
    getSpeeches({ keywords: keywordInput, isRegex, page, dateFilter });
  };

  useEffect(() => {
    debounce(handleSpeechesSearch, 200)();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, page, country]);

  useEffect(() => {
    setPage(0);
  }, [dateFilter, country]);

  const highlightWords = highlightTfIdf
    ? speeches?.speeches[chosenSpeech]?.term_tfidf
        .slice(0, 20)
        .map((word: any) => word.term)
    : keywordInput;

  return (
    <Grid2 container spacing={2} style={{ minHeight: "400px" }}>
      <Grid2 xs={12} style={{ marginBottom: 25 }}>
        <Typography variant="h4" color="common.white">
          Explore{" "}
          <span
            style={{
              textDecoration: "underline",
              textDecorationColor: "#4691bd",
            }}
          >
            {country === "AUT" ? "Austrian" : "German"}
          </span>{" "}
          Speeches
        </Typography>
      </Grid2>
      <Grid2 xs={6}>
        <DatePicker
          value={moment(dateFilter.fromDate)}
          onChange={(newValue) => {
            newValue &&
              setDateFilter({ ...dateFilter, fromDate: newValue.toDate() });
          }}
          renderInput={(params) => <TextField {...params} size="small" />}
        />
      </Grid2>
      <Grid2 xs={6}>
        <DatePicker
          value={moment(dateFilter.toDate)}
          onChange={(newValue) =>
            newValue &&
            setDateFilter({ ...dateFilter, toDate: newValue.toDate() })
          }
          renderInput={(params) => <TextField {...params} size="small" />}
        />
      </Grid2>

      {speeches && (
        <>
          <Grid2 xs={5}>
            <SpeechTable
              speechesResponse={speeches}
              handleChangePage={(page: number) => setPage(page)}
              page={page}
              chosenSpeech={chosenSpeech}
              setChosenSpeech={setChosenSpeech}
            />
          </Grid2>

          <Grid2 xs={6} maxHeight="780px" style={{ margin: 10 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <ToggleButton
                size="small"
                value="check"
                selected={highlightTfIdf}
                onClick={() => setHighlightTfIdf(!highlightTfIdf)}
                style={{
                  visibility: showWordCloud ? "hidden" : "visible",
                  fontSize: "0.6rem",
                }}
              >
                TF-IDF
              </ToggleButton>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="center"
              >
                <Typography>Text</Typography>
                <Switch
                  checked={showWordCloud}
                  onChange={() => setShowWordCloud(!showWordCloud)}
                />
                <Typography>Word Cloud</Typography>
              </Stack>
            </Stack>

            {showWordCloud && (
              <SpeechWordCloud chosenSpeech={speeches.speeches[chosenSpeech]} />
            )}
            {!showWordCloud && (
              <Paper
                style={{
                  height: "100%",
                  padding: 10,

                  //marginTop: 0,
                  //paddingTop: 0,
                  overflow: "scroll",
                  overflowX: "hidden",
                }}
              >
                <p>
                  <Highlighter
                    textToHighlight={speeches.speeches[chosenSpeech].text}
                    searchWords={highlightWords}
                    caseSensitive={isRegex}
                    highlightStyle={{
                      backgroundColor: "white",
                      color: "black",
                      paddingLeft: 2,
                      paddingRight: 2,
                    }}
                  />
                </p>
              </Paper>
            )}
          </Grid2>
        </>
      )}
    </Grid2>
  );
}
