import json

import click
import polars as pl
from amcat4py import AmcatClient
from polars import col
from speech_service import SpeechWordCloudMaker
from tqdm import tqdm

amcat = AmcatClient("http://localhost/amcat")
amcat.login()


def amcat_fieldtypes(df):
    result = {}
    for column_name, dtype in zip(df.columns, df.dtypes):
        if dtype == pl.Utf8:
            long_text_found = False
            for value in df[column_name]:
                if value:
                    if len(value) > 50:
                        long_text_found = True
                        break

            if long_text_found:
                result[column_name] = 'text'
            else:
                result[column_name] = 'keyword'
        elif dtype == pl.Boolean:
            result[column_name] = 'keyword'
        elif dtype == pl.Int32 or dtype == pl.Int64:
            result[column_name] = 'double'
        elif dtype == pl.Date:
            result[column_name] = 'date'
        else:
            result[column_name] = 'object'

    return result


def get_df(path):
    # df = pyreadr.read_r(path)[None]
    df = pl.read_csv(path, try_parse_dates=True)
    df = df.with_columns(
        [
            pl.format(
                "Speech by {} from {}: {}...",
                col("speaker"),
                col("date"),
                col("text").str.slice(0, 20),
            ).alias("title"),
        ]
    ).filter(~col("text").is_null())
    return df


def compute_tf_idf(df, lang):
    vectorizer = SpeechWordCloudMaker(df, lang=lang)
    matrix = vectorizer.vec.transform(df["text"])

    speeches_term_tfidf = []
    # iterate row-wise
    for i in tqdm(range(matrix.shape[0])):
        _, col_indices = matrix[i, :].nonzero()
        speech_tfidf = []

        for j in range(len(col_indices)):
            value = matrix[i, col_indices[j]]
            term = vectorizer.feature_names[col_indices[j]]
            speech_tfidf.append({"term": term, "value": value})
        speech_tfidf.sort(key=lambda x: x["value"], reverse=True)
        speeches_term_tfidf.append(speech_tfidf)
    # speeches_term_tfidf to json
    speeches_term_tfidf_json = [json.dumps(x) for x in speeches_term_tfidf]
    df_new = df.with_columns(
        [pl.Series(speeches_term_tfidf_json).alias("term_tfidf")])
    return df_new


def compute_tf_idf(df, lang):
    print("Computing TF-IDF")
    vectorizer = SpeechWordCloudMaker(df, lang=lang)
    matrix = vectorizer.vec.transform(df["text"])
    print("Done computing TF-IDF")
    print("Upload speeches to AmCAT")
    # iterate row-wise
    for i in tqdm(range(matrix.shape[0])):
        _, col_indices = matrix[i, :].nonzero()
        speech_tfidf = []

        for j in range(len(col_indices)):
            value = matrix[i, col_indices[j]]
            term = vectorizer.feature_names[col_indices[j]]
            speech_tfidf.append({"term": term, "value": value})
        speech_tfidf.sort(key=lambda x: x["value"], reverse=True)
        speech_tfidf = json.dumps(speech_tfidf)
        speech_dict = df[i].to_dicts()[0]
        speech_dict["term_tfidf"] = speech_tfidf
        yield speech_dict


@click.command(
    help="Preprocess and upload speeches to AmCAT. "
    "The speeches should be in a folder called 'data' in the same directory as this script. "
    "The folder should contain a folder for each country, "
    "which should contain a file called 'Corpus_speeches_{country}-fixed.RDS'. "
    "The script will create a new index in AmCAT called 'speeches_{country}'. "
    "The index will have a field called 'party' of type 'keyword'. "
    "The script will also create a pickle file called '{country}_vec.pkl' "
    "which contains the TF-IDF vectorizer for faster re-execution. "
)
@click.argument("country")
def preprocess_and_upload(country):
    print("Preprocessing and uploading speeches for", country)
    country = country.lower()
    speeches = get_df(f"data/{country}/Corpus_speeches_{country}.RDS.csv")
    speeches_tftidf = compute_tf_idf(speeches, country)
    try:
        amcat.delete_index(f"speeches_{country}")
    except:
        pass
    columns = amcat_fieldtypes(speeches)
    columns["term_tfidf"]  = "text"
    del speeches

    # create index and set field types
    amcat.create_index(f"speeches_{country}", guest_role="admin")
    amcat.set_fields(f"speeches_{country}", columns)

    print("Uploading speeches to AmCAT")
    amcat.upload_documents(f"speeches_{country}", speeches_tftidf)


if __name__ == "__main__":
    preprocess_and_upload()
