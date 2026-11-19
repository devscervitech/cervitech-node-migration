export const emailTemplate = {
  signUp: `<!DOCTYPE html>
<html>
<head>
	<title>Welcome to CerviTech!</title>
</head>
<body style="font-family: Arial, sans-serif">
	<table cellpadding="0" cellspacing="0" border="0" width="100%">
		<tr>
			<td align="center" valign="top">
				<a href="https://cervitech.com.ng"><img style="padding-top: 60px" src="https://firebasestorage.googleapis.com/v0/b/cervitech-e4465.appspot.com/o/cervitechLogo2x.png?alt=media&token=ed03f4e5-6bdb-4a58-b7a1-b46ee385b288"></a>
			</td>
		</tr>
		<tr>
			<td align="center" bgcolor="#ffffff" style="padding: 40px 20px 30px 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 24px; color: #333333;">
				<p>Hi [NAME],</p>
				<p>Welcome to CerviTech! We're thrilled to have you as a new member of our community.</p>
				<p>You've taken the first step towards achieving your fitness goals. We're excited to help you along the way.</p>
				<p>Here are a few things you can do to get started:</p>
				<ul>
					<li>
						<a href="#" style="color: #4c2a7f; text-decoration:none">Log in to your account</a>
					</li>
					<li><a href="https://cervitech.com.ng/#" style="color: #4c2a7f; text-decoration: none ">Check out our getting started guide</a></li>
					<li><a href="https://cervitech.com.ng/#" style="color: #4c2a7f; text-decoration: none ">Check out our privacy policy</a></li>
				</ul>
				<p>
					Get started by setting your neck angle goal, we'll prepare a workout program to help you achieve your goals.
					We're always here to help if you have any questions or need assistance. Don't hesitate to reach out to us at <a href="tel:+234-805-964-3996">+234-805-964-3996</a>.
				</p>
				<p>Thanks again for joining CerviTech! We can't wait to see what you'll achieve.</p>
				<p>Best regards,</p>
				<p>CerviTech Team</p>
				<p>
					P.S. Keep an eye out for our emails. We'll be sending you reminders, tips and tricks or exclusive offers to help you get the most out of your experience with us
				</p>
		</tr>
	</table>

	<table style="width: 85%;" border="0" cellspacing="0" cellpadding="0" align="center" bgcolor="#ffffff">
		<tr style="height: auto;">
			<td style="padding: 25px">
				<p>
					Department of Physiotherapy · University of Lagos, Akoka<br>
					<a href="https://cervitech.com.ng">Privacy Policy</a><br>
				<p style="font-size: x-small;">This email was sent to [EMAILHOLDER]. </p>
			</td>
		</tr>
	</table>
</body>
</html>`,

  reminder: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>We Miss You!</title>
</head>
<body style="font-family:Arial, sans-serif">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#fff">
        <tr>
            <td align="center" valign="top">
                <a href="https://cervitech.com.ng"><img height="120px" width="450px" style="padding-top: 60px" src="https://firebasestorage.googleapis.com/v0/b/cervitech-e4465.appspot.com/o/cervitechLogo2x.png?alt=media&token=ed03f4e5-6bdb-4a58-b7a1-b46ee385b288"></a>
            </td>
        </tr>
        <tr>
            <td align="center" valign="top">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff;">
                    <tr>
                        <td align="center" valign="top" style="padding: 40px 20px; font-size: 20px; line-height: 24px; color: #333333;">
                            <h1>We Miss You!</h1>
                            <p>Dear [NAME],</p>
                            <p>It's been a while since you've used our app, and we wanted to check in and see how you're doing. We hope everything is going well for you!</p>
                            <p>If you have any questions or feedback, please don't hesitate to reach out to us. We're always here to help.</p>
                            <p>Thanks for being a valued member of our community, and we hope to see you back in the app soon!</p>
                            <p>Best regards,<br>CerviTech Team</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <table style="max-width: 500px;width: 100%;" border="0" cellspacing="0" cellpadding="0" align="center" bgcolor="#ffffff">
        <tr style="height: auto;">
            <td style="padding: 25px">
                <p>
                    Department of Physiotherapy · University of Lagos, Akoka<br>
                    <a href="https://cervitech.com.ng">Privacy Policy</a><br>
                <p style="font-size: x-small;">This email was sent to [EMAILHOLDER]. </p>
            </td>
        </tr>
    </table>
</body>
</html>`,

  passwordReset: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; text-align:center">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td align="center" valign="top">
                <a href="https://cervitech.com.ng"><img style="padding-top: 60px" src="https://firebasestorage.googleapis.com/v0/b/cervitech-e4465.appspot.com/o/cervitechLogo2x.png?alt=media&token=ed03f4e5-6bdb-4a58-b7a1-b46ee385b288"></a>
            </td>
        </tr>
    </table>
    <p>Hi [Username],</p>
    <p>You recently requested a password reset for your account. Please use the following token to reset your password:</p>
    <p>Token: <span style="font-weight: bold; color: #4c2a7f">[Token]</span></p>
    <p>Please note that the token provided is valid for 30 minutes only. Make sure to reset your password within this timeframe. After 30 minutes, the token will expire, and you'll need to request a new one.</p>
    <p>If you did not request this password reset, please ignore this email.</p>
    <p>Best regards,<br>CerviTech Team</p>
</body>
</html>`,

  accountDeletion: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Account Deletion Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; text-align:center">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td align="center" valign="top">
                <a href="https://cervitech.com.ng"><img style="padding-top: 60px" src="https://firebasestorage.googleapis.com/v0/b/cervitech-e4465.appspot.com/o/cervitechLogo2x.png?alt=media&token=ed03f4e5-6bdb-4a58-b7a1-b46ee385b288"></a>
            </td>
        </tr>
    </table>
    <p>Hi [Username],</p>
    <p>We have received your request to delete your account. We're sorry to see you go, but we understand that sometimes it's necessary to move on.</p>
    <p>Please note that deleting your account is a permanent action and cannot be undone. As a result, all your data and information associated with the account will be permanently removed from our system.</p>
    <p>If you have any remaining questions or concerns, please don't hesitate to reach out to our support team at [support email] or visit our FAQ page on our website.</p>
    <p>Thank you for being a part of our community. We wish you all the best in your future endeavors.</p>
    <p>Best regards,<br>CerviTech Team</p>
</body>
</html>`,

  accountDeletionRequest: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Account Deletion Confirmation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
        }

        .logo {
            padding-top: 20px;
        }

        .btn-danger {
            color: #fff;
            background: -webkit-linear-gradient(0deg, #2C0C56 0%, #653893 100%);
            border: 1px solid #653893;
            width: 30%;
            border-radius: 5px;
            height: 40px;
            position: relative;
            display: block;
            text-decoration: none;
            margin: 0 auto;
            text-align: center;
            color:white;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    </style>
    <script>
        function confirm(email, token, link) {
            location.href = \`\${link}?email\${email}&\${token}\`;
        }
    </script>
</head>
<body>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td align="center" valign="top">
                <a href="https://cervitech.com.ng"><img class="logo" src="https://firebasestorage.googleapis.com/v0/b/cervitech-e4465.appspot.com/o/cervitechLogo2x.png?alt=media&token=ed03f4e5-6bdb-4a58-b7a1-b46ee385b288"></a>
            </td>
        </tr>
    </table>
    <p style="margin-top:5px">Hi [Username],</p>
    <p>Thank you for using CerviTech. You've initiated the account deletion process. Please follow the link below to confirm the deletion:</p>
    <a href="[ConfirmationLink]?email=[email]&token=[Token]" target="_blank" class="btn btn-danger">Confirm Account Deletion</a>
    <p>If you didn't request this, you can ignore this email, and your account will remain active.</p>
    <p>Feel free to reach out to our support team at [support email] if you have any questions or concerns.</p>
    <p>Best regards,<br>CerviTech Team</p>
</body>
</html>`
};