# TouristStar bus ticket booking

This project is a static HTML/CSS/JavaScript website backed by Supabase Auth and Postgres.

## Setup

1. Open the Supabase project connected to this app, open **SQL Editor**, paste all of `supabase_setup.sql`, and run it.
2. Check `frontend/supabase-config.js`. It contains the project URL and browser publishable key. A publishable key is designed for browser use; never put a Supabase `service_role` or secret key in frontend files.
3. Start a local web server from the `frontend` folder. For example, from the project folder run `npx serve frontend`, then open the local URL it prints. Opening `index.html` directly as a `file://` URL will not work reliably with Supabase Auth.
4. Create an account. If email confirmation is enabled in Supabase Auth, confirm the email before signing in. Add your local development URL under **Authentication > URL Configuration** in Supabase.
5. Search the example routes and dates, choose a bus, select seats, and confirm the booking. Use **My bookings** to view or cancel a future ticket.

The SQL inserts a small sample fleet and trips relative to the moment the SQL is run. Change the sample route, fare, and schedule rows near the end of the SQL file for your demonstration. Creating and editing routes in an admin screen is not included; add or update those rows using Supabase Table Editor.

## Pages

- `frontend/index.html` - route and travel-date search
- `frontend/signup.html` and `frontend/login.html` - Supabase account registration and sign-in
- `frontend/booking.html` - seat selection and atomic booking
- `frontend/tickets.html` - booking history and cancellation
- `frontend/contactus.html` - matching contact page; submitted messages are saved in `contact_messages`
- `frontend/profile.html` - passenger profile details

Booking creation and cancellation happen in database functions. Row Level Security restricts profile and ticket details to their owner, and booking requests lock the trip row while checking and reserving seats so two confirmed bookings cannot take the same seat. Cancelling a booking releases its seats.
