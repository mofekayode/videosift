declare module 'youtube-transcript-api' {
  interface TranscriptSegment {
    start: number;
    duration: number;
    text: string;
  }

  interface YoutubeTranscriptApi {
    getTranscript(videoId: string): Promise<TranscriptSegment[]>;
  }

  const YoutubeTranscriptApi: YoutubeTranscriptApi;
  export default YoutubeTranscriptApi;
}
