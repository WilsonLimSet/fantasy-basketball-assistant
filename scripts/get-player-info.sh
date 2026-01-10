#!/bin/bash
# Get player info for watchlist players
curl -s "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/players?scoringPeriodId=0&view=players_wl" \
  --cookie "espn_s2=AEAiDHiqUfZi6c%2B6HGn8wzcAFQBl5yLfSfVyWV78P82eH5W51OfyDh7ntkP7FXyZmhSmLlpKAQIH5vHUv4frlLQFpY2wAme5PMymEetWZt1QEA2rmoWsSNhMRR%2BZG2D1kDAhMJ0SwUZM7I%2FFVSFhji%2Bi7p8RNjWmt18BEQDSZzyOyrUBV0l2FGEt7X5WzMaUiqHJ8kz2xNm1MxqqI4dD6UcS3qWL4xq2WyFPDGBt4sWICNNXBous1P1Jqw3mAeWvEzkNMYoJ%2BXWuXx8Bf8OobBUhtnqsHXmUlxcz8GiUN8nALO2E1rM40r4Tzm70lOLPNtU%3D; SWID={501F4AF8-23C0-493E-B70B-21B2E6ACCD83}" \
  -H "x-fantasy-filter: {\"players\":{\"filterIds\":{\"value\":[4278580,4898371]}}}" | jq '.[] | {id, fullName, proTeamId}'
