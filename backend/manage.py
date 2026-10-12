"""Database & ops CLI.  Usage: python manage.py <command>
  migrate | stats | create-super EMAIL | reset-password EMAIL | backup FILE | restore FILE | set-domain example.com"""
import os, sys, getpass, subprocess
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
os.environ.setdefault("SECRET_KEY", "cli-only-not-used-for-sessions-0000000000")
import main

def need(n):
    if len(sys.argv) < n: sys.exit(__doc__)
    return sys.argv[n - 1]

def run():
    c = need(2); url = os.environ["DATABASE_URL"]
    if c == "set-domain":
        d = need(3)
        for f in ("index.html", "robots.txt", "sitemap.xml"):
            p = Path(__file__).parent / "static" / f; p.write_text(p.read_text().replace("YOUR-DOMAIN", d))
        return print("domain set to", d)
    if c == "backup": return subprocess.run(["pg_dump", "-Fc", "-f", need(3), url], check=True)
    if c == "restore": return subprocess.run(["pg_restore", "--clean", "--if-exists", "--no-owner", "-d", url, need(3)], check=True)
    main.pool.open(); main.migrate()
    if c == "migrate": print("schema up to date")
    elif c == "stats": print(main.q("select role, status, count(*) n from users group by 1,2 order by 1,2"))
    elif c == "create-super":
        p = getpass.getpass("Password (12+ chars): ")
        if len(p) < 12: sys.exit("too short")
        main.make_super(need(3), p); print("created")
    elif c == "reset-password":
        p = getpass.getpass("New password (8+ chars): ")
        if len(p) < 8: sys.exit("too short")
        main.q("update users set pw=%s where lower(email)=%s", (main.hp(p), need(3).lower())); print("password reset")
    else: sys.exit(__doc__)
    main.pool.close()
run()
