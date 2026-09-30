# Auth — what's included

## Sign in and sign up

Classic manual sign-up: pick a name, email and password, hit the button — and you're in.

![Auth page](screenshots/feature/auth/Auth-page.png)

You can't sign in right after sign-up — you need to verify your email first. Without verification login just won't let you in and will ask you to check your inbox.

## Emails

We send emails ourselves through our own mail module on nodemailer (SMTP). Here's what a letter from us looks like:

![Email from Polygon](screenshots/feature/auth/Appearance_of_email_from_us.png)

What emails we have:

- email verification after sign-up — the link lives for 24 hours;
- password reset — the link lives for 1 hour;
- resend the letter if the first one got lost or expired.

If mail isn't configured or fails — sign-up still succeeds, the letter just won't arrive. We log the error, we don't fail the user.

About retries in simple words: the "send again" button can't be pressed more often than once a minute — that's our spam protection. The old link burns when you resend, only the new one works. Password can't be brute-forced either: after 5 wrong attempts login is locked for 15 minutes.

## Forgot password

It's the classic flow:

1. you enter your email on the "forgot password" page;
2. if we have that email — a link arrives;
3. you follow the link and set a new password;
4. after changing the password you're logged out everywhere — you need to sign in again on all devices. That's for safety, in case the password was stolen.

We deliberately answer the same way whether the email exists or not — so a stranger can't probe who's registered here.

## Sign in with Google and GitHub

You can skip the password and sign in in one click with Google or GitHub.

How it feels: press the button → you go to Google/GitHub → allow access → you're brought back already signed in.

No need to verify email in that case — if Google already checked it, we trust it. If it's your first time — we just create an account for you; if that email was already here — we link the button sign-in to it.

## My devices and per-device logout

You can be online from several places at once: phone, laptop, second browser — everything works in parallel, sessions don't kick each other out.

![Active sessions](screenshots/feature/auth/device.png)

In settings there's a "my devices" list: you see where you're signed in, from which browser, and when it was last active, the current device is marked.

What you can do:

- log out just on this device;
- kick one specific other device (e.g. forgot to log out at work);
- press "log out everywhere except this one";
- change your password — it kicks you out absolutely everywhere.

Bottom line: plain sign-up with emails, password reset, sign-in with Google/GitHub, plus proper multi-device — sit wherever you want and close any single device on demand.
