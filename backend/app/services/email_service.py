import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ..config import settings


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.ALERT_EMAIL)


def send_low_stock_alert(products: list[dict]) -> bool:
    """Send a low-stock alert email. Returns True if sent, False if SMTP not configured."""
    if not _smtp_configured():
        return False

    recipients = [e.strip() for e in settings.ALERT_EMAIL.split(",") if e.strip()]
    if not recipients:
        return False

    subject = f"[Fab Construction IMS] Low Stock Alert — {len(products)} item(s)"

    rows = "".join(
        f"<tr>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #e2e8f0'>{p['name']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center'>{p['quantity']} {p['unit']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center'>{p['min_stock_level']} {p['unit']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #e2e8f0'>{p.get('location', '—')}</td>"
        f"</tr>"
        for p in products
    )

    html = f"""
    <html><body style="font-family:sans-serif;color:#1e293b;margin:0;padding:0">
      <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#dc2626;padding:20px 24px">
          <h1 style="color:#fff;margin:0;font-size:18px">⚠️ Low Stock Alert</h1>
          <p style="color:#fca5a5;margin:4px 0 0">Fab Construction IMS</p>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px">The following <strong>{len(products)}</strong> product(s) are at or below their minimum stock level:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Product</th>
                <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0">Current</th>
                <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0">Minimum</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Warehouse</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
          <p style="margin:20px 0 0;color:#64748b;font-size:13px">
            Please restock these items or create a Purchase Order in the IMS.
          </p>
        </div>
      </div>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], recipients, msg.as_string())
        return True
    except Exception as exc:
        print(f"[email_service] Failed to send alert: {exc}")
        return False
