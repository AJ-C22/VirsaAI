import psycopg2
import pathlib

def run_sql_file(path):
    sql = pathlib.Path(path).read_text()

    conn = psycopg2.connect(
        dbname="virsa",
        user="postgres",
        password="postgres",
        host="localhost",
        port="5433",
    )

    with conn:
        with conn.cursor() as cur:
            cur.execute(sql)

    conn.close()

run_sql_file("db/schema.sql")
