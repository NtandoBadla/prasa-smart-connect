declare module "vader-sentiment" {
  const vader: {
    SentimentIntensityAnalyzer: {
      polarity_scores(text: string): {
        pos: number;
        neu: number;
        neg: number;
        compound: number;
      };
    };
  };
  export default vader;
}
