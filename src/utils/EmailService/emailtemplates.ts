// emailTemplates.ts
import { EmailUtils } from './emailutils';
import * as dotenv from 'dotenv';
dotenv.config();

const baseUrl = process.env.BACKEND_URL;

const frontendBaseUrl = process.env.FRONTEND_URL;

export const EmailTemplates = {
  accountDeletion: (username: string) => {
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://cervitech.com.ng/img/logos/logo.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(246,248,250);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-top:40px;padding-bottom:40px'>
    <!--$-->
    <div
      style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0"
      data-skip-in-text="true">
      Account Deletion Confirmation - CerviTech
      <div>
         ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿
      </div>
    </div>
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="background-color:rgb(255,255,255);margin-left:auto;margin-right:auto;padding-top:40px;padding-bottom:40px;padding-left:20px;padding-right:20px;border-radius:8px;max-width:600px">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;margin-bottom:40px">
              <tbody>
                <tr>
                  <td>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <a
                            href="https://cervitech.com.ng"
                            style="text-decoration: none"
                            target="_blank"
                            ><img
                              alt="CerviTech Logo"
                              src="https://cervitech.com.ng/img/logos/logo.png"
                              style="height: 48px; width: auto; display: block; outline: none; border: none; text-decoration: none"
                          /></a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:left">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      Hi
                      ${username},
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      We have received your request to delete your account.
                      We&#x27;re sorry to see you go, but we understand that
                      sometimes it&#x27;s necessary to move on.
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      Please note that deleting your account is a permanent
                      action and cannot be undone. As a result, all your data
                      and information associated with the account will be
                      permanently removed from our system.
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      If you have any remaining questions or concerns, please
                      don&#x27;t hesitate to reach out to our support team at<!-- -->
                      <a
                        href="mailto:contact.cervitech@gmail.com"
                        style="color:rgb(148,59,253);text-decoration-line:underline"
                        target="_blank"
                        >contact.cervitech@gmail.com</a
                      >
                      <!-- -->or visit our FAQ page on our<!-- -->
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:underline"
                        target="_blank"
                        >website</a
                      >.
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:24px;margin-top:16px">
                      Thank you for being a part of our community. We wish you
                      all the best in your future endeavors.
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:40px;margin-top:16px">
                      Best regards,<br />CerviTech Team
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="border-top-width:1px;border-style:solid;border-color:rgb(229,231,235);padding-top:20px;margin-top:40px">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="color:rgb(102,102,102);font-size:12px;line-height:16px;text-align:center;margin:0px;margin-bottom:8px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Department of Physiotherapy · University of Lagos, Akoka,
                      Lagos, Nigeria
                    </p>
                    <p
                      style="color:rgb(102,102,102);font-size:12px;line-height:16px;text-align:center;margin:0px;margin-bottom:8px;margin-top:0px;margin-left:0px;margin-right:0px">
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:underline"
                        target="_blank"
                        >Unsubscribe</a
                      >
                    </p>
                    <p
                      style="color:rgb(102,102,102);font-size:12px;line-height:16px;text-align:center;margin:0px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px">
                      © 2023 Copyright: CerviTech
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    <!--7--><!--/$-->
  </body>
</html>`;
  },

  passwordResetOtp: (username: string, otpCode: string) => {
    return `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://cervitech.com.ng/img/logos/logo.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(246,248,250);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-top:40px;padding-bottom:40px'>
    <!--$-->
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="background-color:rgb(255,255,255);max-width:600px;margin-left:auto;margin-right:auto;padding-left:32px;padding-right:32px;padding-top:40px;padding-bottom:40px;border-radius:8px">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;margin-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto; margin-bottom: 24px;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <a
                            href="https://cervitech.com.ng"
                            style="text-decoration: none"
                            target="_blank"
                            ><img
                              alt="CerviTech Logo"
                              src="https://cervitech.com.ng/img/logos/logo.png"
                              style="height: 48px; width: auto; display: block; outline: none; border: none; text-decoration: none"
                          /></a>
                        </td>
                      </tr>
                    </table>
                    <p
                      style="font-size:24px;font-weight:700;color:rgb(2,3,4);margin:0px;line-height:24px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px">
                      Password Reset Request
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="margin-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="font-size:16px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;line-height:24px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Hi
                      ${username},
                    </p>
                    <p
                      style="font-size:16px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;line-height:24px;margin-top:0px;margin-left:0px;margin-right:0px">
                      You requested a password reset for your CerviTech account.
                      Enter the code below in the app to set your new password
                      and continue monitoring your neck posture health.
                    </p>
                    <table
                      align="center"
                      width="100%"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="text-align:center;margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td
                            style="background-color:rgb(247,242,255);border:2px dashed rgb(148,59,253);border-radius:8px;padding-top:16px;padding-bottom:16px;font-size:32px;font-weight:700;color:rgb(148,59,253);letter-spacing:8px;mso-line-height-rule:exactly;line-height:36px">
                            ${otpCode}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p
                      style="font-size:14px;color:rgb(102,102,102);margin-bottom:0px;margin:0px;text-align:center;line-height:24px;margin-top:0px;margin-left:0px;margin-right:0px">
                      This code will expire in 10 minutes for your security.
                    </p>
                    <p
                      style="font-size:16px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;line-height:24px;margin-top:0px;margin-left:0px;margin-right:0px">
                      If you didn&#x27;t request this password reset, please
                      ignore this email. Your account remains secure and no
                      changes will be made.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <hr
              style="border-color:rgb(229,231,235);border-style:solid;margin-top:32px;margin-bottom:32px;width:100%;border:none;border-top:1px solid #eaeaea" />
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="font-size:16px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;line-height:24px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Best regards,<br /><strong>CerviTech Team</strong>
                    </p>
                    <p
                      style="font-size:12px;color:rgb(102,102,102);margin-bottom:0px;margin:0px;line-height:24px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Department of Physiotherapy · University of Lagos, Akoka,
                      Lagos, Nigeria
                    </p>
                    <p
                      style="font-size:12px;color:rgb(102,102,102);margin-bottom:0px;margin:0px;line-height:24px;margin-top:0px;margin-left:0px;margin-right:0px">
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:none;font-size:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px"
                        target="_blank"
                        ><span
                          ><!--[if mso]><i style="mso-font-width:0%;mso-text-raise:0" hidden></i><![endif]--></span
                        ><span
                          style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px"
                          >Visit CerviTech</span
                        ><span
                          ><!--[if mso]><i style="mso-font-width:0%" hidden>&#8203;</i><![endif]--></span
                        ></a
                      >
                      |
                      <a
                        href="mailto:support@cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:none;font-size:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px"
                        target="_blank"
                        ><span
                          ><!--[if mso]><i style="mso-font-width:0%;mso-text-raise:0" hidden></i><![endif]--></span
                        ><span
                          style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px"
                          >Contact Support</span
                        ><span
                          ><!--[if mso]><i style="mso-font-width:0%" hidden>&#8203;</i><![endif]--></span
                        ></a
                      >
                    </p>
                    <p
                      style="font-size:12px;color:rgb(102,102,102);margin:0px;line-height:24px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px">
                      © 2023 Copyright: CerviTech
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    <!--7--><!--/$-->
  </body>
</html>
    `;
  },

  signUp: (username: string) => {
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://cervitech.com.ng/img/logos/logo.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(246,248,250);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-top:40px;padding-bottom:40px'>
    <!--$-->
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="background-color:rgb(255,255,255);max-width:600px;margin-left:auto;margin-right:auto">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;padding-top:40px;padding-bottom:40px">
              <tbody>
                <tr>
                  <td>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <a
                            href="https://cervitech.com.ng"
                            style="text-decoration: none"
                            target="_blank"
                            ><img
                              alt="CerviTech Logo"
                              src="https://cervitech.com.ng/img/logos/logo.png"
                              style="height: 48px; width: auto; display: block; outline: none; border: none; text-decoration: none"
                          /></a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="padding-left:40px;padding-right:40px;padding-bottom:40px">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="font-size:24px;font-weight:700;color:rgb(2,3,4);margin-bottom:24px;text-align:center;line-height:24px;margin-top:16px">
                      Welcome to CerviTech!
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:16px;margin-top:16px">
                      Hi
                      ${username},
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:24px;margin-top:16px">
                      Thank you for joining CerviTech. We&#x27;re excited to
                      help you monitor and improve your neck posture through our
                      smartphone application.
                    </p>
                    <table
                      align="center"
                      width="100%"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="text-align:center;margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td>
                            <a
                              href="https://cervitech.com.ng"
                              style="background-color:rgb(148,59,253);color:rgb(255,255,255);padding-left:32px;padding-right:32px;padding-top:16px;padding-bottom:16px;border-radius:8px;font-weight:500;font-size:16px;text-decoration-line:none;display:inline-block;box-sizing:border-box;line-height:100%;text-decoration:none;max-width:100%;mso-padding-alt:0px"
                              target="_blank"
                              ><span
                                ><!--[if mso]><i style="mso-font-width:400%;mso-text-raise:24" hidden>&#8202;&#8202;&#8202;&#8202;</i><![endif]--></span
                              ><span
                                style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:12px"
                                >Get Started</span
                              ><span
                                ><!--[if mso]><i style="mso-font-width:400%" hidden>&#8202;&#8202;&#8202;&#8202;&#8203;</i><![endif]--></span
                              ></a
                            >
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:16px;margin-top:16px">
                      Here&#x27;s what you can do next:
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:8px;margin-top:16px">
                      •
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:none"
                        target="_blank"
                        >Set up your posture monitoring goals</a
                      >
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:8px;margin-top:16px">
                      •
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:none"
                        target="_blank"
                        >Explore our exercise library</a
                      >
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:24px;margin-top:16px">
                      •
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:none"
                        target="_blank"
                        >Track your progress with our charts</a
                      >
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:16px;margin-top:16px">
                      If you need assistance, please contact us at<!-- -->
                      <a
                        href="tel:+234-805-964-3996"
                        style="color:rgb(148,59,253);text-decoration-line:none"
                        target="_blank"
                        >+234-805-964-3996</a
                      >.
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:8px;margin-top:16px">
                      Best regards,
                    </p>
                    <p
                      style="font-size:16px;line-height:24px;color:rgb(2,3,4);margin-bottom:16px;margin-top:16px">
                      The CerviTech Team
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="background-color:rgb(246,248,250);padding-left:40px;padding-right:40px;padding-top:24px;padding-bottom:24px;text-align:center">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="font-size:14px;line-height:20px;color:rgb(75,85,99);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Department of Physiotherapy · University of Lagos, Akoka,
                      Lagos, Nigeria
                    </p>
                    <p
                      style="font-size:12px;line-height:16px;color:rgb(107,114,128);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                      © 2023 Copyright: CerviTech
                    </p>
                    <p
                      style="font-size:12px;line-height:16px;color:rgb(107,114,128);margin:0px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px">
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:underline"
                        target="_blank"
                        >Unsubscribe</a
                      >
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    <!--7--><!--/$-->
  </body>
</html>`;
  },

  reminder: (username: string) => {
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://cervitech.com.ng/img/logos/logo.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(246,248,250);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-top:60px;padding-bottom:60px'>
    <!--$-->
    <div
      style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0"
      data-skip-in-text="true">
      We miss you! Come back to CerviTech and continue your neck health journey.
      <div>
         ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿
      </div>
    </div>
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="max-width:600px;margin-left:auto;margin-right:auto;background-color:rgb(255,255,255);border-radius:8px">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;padding-top:60px;padding-bottom:40px;padding-left:40px;padding-right:40px">
              <tbody>
                <tr>
                  <td>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <a
                            href="https://cervitech.com.ng"
                            style="text-decoration: none"
                            target="_blank"
                            ><img
                              alt="CerviTech Logo"
                              src="https://cervitech.com.ng/img/logos/logo.png"
                              style="height: 48px; width: auto; display: block; outline: none; border: none; text-decoration: none"
                          /></a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="padding-left:40px;padding-right:40px;padding-top:40px;padding-bottom:40px;text-align:center">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="font-size:24px;line-height:32px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;font-weight:500;margin-top:0px;margin-left:0px;margin-right:0px">
                      Dear <strong>${username}</strong>,
                    </p>
                    <p
                      style="font-size:18px;line-height:28px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                      It&#x27;s been a while since you&#x27;ve used our neck
                      posture monitoring app, and we wanted to check in and see
                      how you&#x27;re doing. We hope everything is going well
                      for you!
                    </p>
                    <p
                      style="font-size:18px;line-height:28px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Your progress charts and exercise routines are still
                      waiting for you. If you have any questions or feedback
                      about your neck health journey, please don&#x27;t hesitate
                      to reach out to us.
                    </p>
                    <p
                      style="font-size:18px;line-height:28px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Thanks for being a valued member of our health-conscious
                      community, and we hope to see you back in the app soon to
                      continue monitoring your posture goals!
                    </p>
                    <p
                      style="font-size:18px;line-height:28px;color:rgb(2,3,4);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Best regards,<br /><strong>CerviTech Team</strong>
                    </p>
                    <a
                      href="https://cervitech.com.ng"
                      style="display:inline-block;padding-left:32px;padding-right:32px;padding-top:16px;padding-bottom:16px;background-color:rgb(148,59,253);color:rgb(255,255,255);text-decoration-line:none;border-radius:8px;font-weight:500;box-sizing:border-box;font-size:16px;margin-bottom:40px;line-height:100%;text-decoration:none;max-width:100%;mso-padding-alt:0px"
                      target="_blank"
                      ><span
                        ><!--[if mso]><i style="mso-font-width:400%;mso-text-raise:24" hidden>&#8202;&#8202;&#8202;&#8202;</i><![endif]--></span
                      ><span
                        style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:12px"
                        >Return to App</span
                      ><span
                        ><!--[if mso]><i style="mso-font-width:400%" hidden>&#8202;&#8202;&#8202;&#8202;&#8203;</i><![endif]--></span
                      ></a
                    >
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="max-width:500px;margin-left:auto;margin-right:auto;background-color:rgb(255,255,255);border-top-width:1px;border-style:solid;border-color:rgb(229,231,235);margin-top:40px">
              <tbody>
                <tr>
                  <td>
                    <table
                      align="center"
                      width="100%"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="padding-left:40px;padding-right:40px;padding-top:40px;padding-bottom:40px;text-align:center;max-width:37.5em">
                      <tbody>
                        <tr style="width:100%">
                          <td>
                            <p
                              style="font-size:14px;line-height:22px;color:rgb(107,114,128);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                              Department of Physiotherapy · University of Lagos,
                              Akoka, Lagos, Nigeria
                            </p>
                            <p
                              style="font-size:14px;line-height:22px;color:rgb(107,114,128);margin-bottom:0px;margin:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                              If you no longer wish to receive these emails,<!-- -->
                              <a
                                href="#"
                                style="color:rgb(148,59,253);text-decoration-line:underline"
                                target="_blank"
                                >unsubscribe</a
                              >.
                            </p>
                            <p
                              style="font-size:12px;line-height:18px;color:rgb(156,163,175);margin:0px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px">
                              © 2023 Copyright: CerviTech
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    <!--7--><!--/$-->
  </body>
</html>`;
  },

  accountDeletionRequest: (username: string, to: string, token: string) => {
    // Deletion is a destructive DELETE call, so (like the password-reset link)
    // this points at a frontend confirmation page rather than the API route directly.
    const confirmationLink = `${frontendBaseUrl}/confirm-account-deletion?token=${encodeURIComponent(token)}`;

    return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://cervitech.com.ng/img/logos/logo.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(246,248,250);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-top:40px;padding-bottom:40px'>
    <!--$-->
    <div
      style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0"
      data-skip-in-text="true">
      Confirm your CerviTech account deletion
      <div>
         ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏
      </div>
    </div>
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="background-color:rgb(255,255,255);max-width:600px;margin-left:auto;margin-right:auto;border-radius:8px;overflow:hidden">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;padding-top:32px;padding-bottom:24px">
              <tbody>
                <tr>
                  <td>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <a
                            href="https://cervitech.com.ng"
                            style="text-decoration: none"
                            target="_blank"
                            ><img
                              alt="CerviTech Logo"
                              src="https://cervitech.com.ng/img/logos/logo.png"
                              style="height: 48px; width: auto; display: block; outline: none; border: none; text-decoration: none"
                          /></a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="padding-left:32px;padding-right:32px;padding-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      Hi
                      ${username},
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      Thank you for using CerviTech. You&#x27;ve initiated the
                      account deletion process. Please follow the link below to
                      confirm the deletion:
                    </p>
                    <table
                      align="center"
                      width="100%"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="text-align:center;margin-top:32px;margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td>
                            <a
                              href="${confirmationLink}"
                              style="background-color:rgb(148,59,253);color:rgb(255,255,255);font-weight:700;font-size:14px;padding-left:25px;padding-right:25px;padding-top:12px;padding-bottom:12px;border-radius:5px;text-align:center;display:inline-block;width:200px;box-sizing:border-box;line-height:100%;text-decoration:none;max-width:100%;mso-padding-alt:0px;background:linear-gradient(0deg, #2C0C56 0%, #653893 100%);border:1px solid #653893"
                              target="_blank"
                              ><span
                                ><!--[if mso]><i style="mso-font-width:416.6666666666667%;mso-text-raise:18" hidden>&#8202;&#8202;&#8202;</i><![endif]--></span
                              ><span
                                style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:9px"
                                >Confirm Account Deletion</span
                              ><span
                                ><!--[if mso]><i style="mso-font-width:416.6666666666667%" hidden>&#8202;&#8202;&#8202;&#8203;</i><![endif]--></span
                              ></a
                            >
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      If you didn&#x27;t request this, you can ignore this
                      email, and your account will remain active.
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      Feel free to reach out to our support team at<!-- -->
                      <a
                        href="mailto:contact.cervitech@gmail.com"
                        style="color:rgb(148,59,253);font-weight:700;text-decoration-line:none"
                        target="_blank"
                        >contact.cervitech@gmail.com</a
                      >
                      <!-- -->if you have any questions or concerns.
                    </p>
                    <p
                      style="color:rgb(2,3,4);font-size:16px;line-height:24px;margin-bottom:24px;margin-top:16px">
                      Best regards,<br />CerviTech Team
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="background-color:rgb(246,248,250);padding-left:32px;padding-right:32px;padding-top:24px;padding-bottom:24px;text-align:center;border-top-width:1px;border-style:solid;border-color:rgb(229,231,235)">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="color:rgb(107,114,128);font-size:12px;line-height:16px;margin:0px;margin-bottom:8px;margin-top:0px;margin-left:0px;margin-right:0px">
                      Department of Physiotherapy · University of Lagos, Akoka,
                      Lagos, Nigeria
                    </p>
                    <p
                      style="color:rgb(107,114,128);font-size:12px;line-height:16px;margin:0px;margin-bottom:8px;margin-top:0px;margin-left:0px;margin-right:0px">
                      <a
                        href="https://cervitech.com.ng"
                        style="color:rgb(148,59,253);text-decoration-line:none"
                        target="_blank"
                        >Visit our website</a
                      >
                      <!-- -->|<!-- -->
                      <a
                        href="#"
                        style="color:rgb(148,59,253);text-decoration-line:none"
                        target="_blank"
                        >Unsubscribe</a
                      >
                    </p>
                    <p
                      style="color:rgb(107,114,128);font-size:12px;line-height:16px;margin:0px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px">
                      © 2023 Copyright: CerviTech
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    <!--7--><!--/$-->
  </body>
</html>`;
  },
};
