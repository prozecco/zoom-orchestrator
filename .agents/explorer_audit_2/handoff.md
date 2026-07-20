# Handoff Report - Database Integrity, PostgreSQL Compatibility & Transactions

## 1. Observation
- **Missing Schema Column**: In `storage.py` (lines 95-106), the `users` table is created without a `zoom_registrant_id` column. However, `app.py` (lines 1105, 1110, 1143) and `web_server.py` (lines 1535, 1582, 1588, 1627) perform queries referencing `zoom_registrant_id` directly, e.g.:
  ```python
  cursor.execute(
      "INSERT INTO users (registered_email, telegram_id, global_status, created_at, country, zoom_registrant_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
      (email, None, db_status, zoom_create_time, zoom_country, zoom_reg_id, zoom_metadata_json)
  )
  ```
- **Migration Rollback Bug**: In `migrate_to_postgres.py` (lines 51-62), `pg_conn.rollback()` is called in the loop if any row migration fails, but `pg_conn.commit()` is only called outside the loop after all rows have been iterated:
  ```python
  for row in rows:
      try:
          pg_cur.execute(insert_query, vals)
          migrated += 1
      except Exception as e:
          print(f"[WARNING] Failed to migrate row {vals}: {e}")
          pg_conn.rollback()
  pg_conn.commit()
  ```
- **Non-Atomic Actions**: In `app.py` (lines 243-246), status updates and submission history logs are committed in separate transactions:
  ```python
  storage.update_user_status(email, "Approved")
  with storage.get_db() as conn:
      conn.execute("UPDATE submissions_history SET action_taken = 'Approved' WHERE id = ?", (sub_id,))
  ```
- **N+1 Connection & Query Loop**: In `app.py` (lines 854-862), inside a loop over `page_rows` of size 10, a new database connection context is opened and closed:
  ```python
  for row in page_rows:
      with storage.get_db() as conn2:
          c2 = conn2.execute("SELECT id FROM submissions_history WHERE registered_email = ...")
  ```
- **Missing Indexes**: In `storage.py` (lines 93-189), the columns `users.telegram_id`, `submissions_history.registered_email`, and `chat_history.chat_id` are defined and queried but do not have indexes.
- **Verification Command Result**: Running `python -m unittest test_system.py` yielded:
  ```
  Ran 7 tests in 1.173s
  OK
  ```

---

## 2. Logic Chain
1. Since the `users` table schema does not define `zoom_registrant_id`, any SQL query trying to select, insert, or update `zoom_registrant_id` on the `users` table will fail database parsing. Since the `/synczoom` bot command and `/api/admin/sync` API endpoint call these queries, they will crash on execution.
2. In psycopg2, calling `rollback()` rolls back the entire current transaction. If a row fails to migrate at index $N$, calling `rollback()` undoes all successfully migrated rows $1$ through $N-1$ in that table. Since `commit()` is only called at the end, only rows processed *after* the last rollback are saved, leading to massive data loss.
3. Because `update_user_status()` and `conn.execute()` run under separate connections and transactions in `admin_decision_callback`, if the second query fails (due to connection loss or crash), the user status will be updated but the submission log remains unchanged, creating a database inconsistency.
4. Calling `get_db()` inside a loop of size 10 opens and closes 10 TCP/TLS connections sequentially. If the database is hosted on a remote PostgreSQL service like Supabase, this introduces a minimum of $10 \times 100\text{ms} = 1.0\text{s}$ of connection latency, causing sluggish bot interactions.
5. Querying database columns like `users.telegram_id`, `submissions_history.registered_email`, and `chat_history.chat_id` without B-tree indexes forces full table scans. Over time, as data sizes grow, performance will degrade linearly (O(N)).

---

## 3. Caveats
- No caveats. The database files, migration scripts, and queries in web server and bot commands were fully audited. We assumed that the local SQLite database behaves similarly to remote PostgreSQL except for syntax variations handled by the `DatabaseCursorWrapper`.

---

## 4. Conclusion
The database implementation contains several critical schema and transactional issues. The system cannot synchronize registrant info from Zoom to local database due to the missing `zoom_registrant_id` column. Additionally, the migration script suffers from rollback data loss, and the bot and API suffer from transaction inconsistency and latency due to non-atomic updates and N+1 queries.

---

## 5. Verification Method
- **Test execution**: Run `python -m unittest test_system.py`. While the basic unit tests pass because they don't cover the `/synczoom` command database interactions, you can verify the schema bug by running:
  ```python
  import storage
  with storage.get_db() as cursor:
      cursor.execute("SELECT zoom_registrant_id FROM users;")
  ```
  This will raise an OperationalError: `no such column: zoom_registrant_id`.
