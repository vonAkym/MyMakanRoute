# MyMakanRoute

A guide for smart food hopping and discovery in Malaysia. Final year project (CAT405), School of Computer Sciences, Universiti Sains Malaysia.

Author: Danial Hakim bin Kamal Azwa
Supervisor: Dr. Zarul Fitri Zaaba

## Modules

| Module | Submodules |
| --- | --- |
| User Management | Registration, Login, Profile and Preference Setup |
| Food Discovery | Food Place Searching, Hidden Gem Highlighting, Food Place Visualisation |
| Food Hopping | Itinerary Planner, Route Planner, Itinerary Review and Customisation, Past Food Hopping Visualisation |
| Food Stalls Analytics | Food Places Visualisation, Food Places Analysis, Food Place Suggestion |

Filtering (halal, budget, cuisine, dietary needs) is applied inside the modules above.

## Structure

```
backend/   Node.js + Express API, one folder per module in src/modules
web/       React web app (admin and user)
mobile/    React Native app
data/      Sample place data and scripts
docs/      Proposal, diagrams, meeting notes
```

## Getting started

Backend:

```
cd backend
npm install
npm run dev
```

The API starts on http://localhost:3000. Check http://localhost:3000/health.

Web and mobile apps are created later:

```
npm create vite@latest web -- --template react
npx create-expo-app@latest mobile
```
