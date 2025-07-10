import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            MindSift
          </h1>
          <p className="text-xl text-muted-foreground">
            Chat with any YouTube video using AI
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="youtube-url" className="text-sm font-medium">
                Paste YouTube Link
              </label>
              <Input
                id="youtube-url"
                placeholder="https://www.youtube.com/watch?v=..."
                type="url"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="first-question" className="text-sm font-medium">
                Ask Your First Question
              </label>
              <Input
                id="first-question"
                placeholder="What is this video about?"
              />
            </div>
            
            <Button className="w-full">
              Start Chatting
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Or{' '}
                <Button variant="link" className="p-0 h-auto">
                  log in to search entire channels & save chats
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="outline" size="sm">
            Summarize this video
          </Button>
          <Button variant="outline" size="sm">
            Give me the key takeaways
          </Button>
          <Button variant="outline" size="sm">
            Explain the main points
          </Button>
        </div>
      </div>
    </div>
  );
}
