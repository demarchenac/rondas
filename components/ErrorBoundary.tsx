import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-background px-6">
          <Text className="mb-2 text-xl font-bold text-foreground">
            Something went wrong
          </Text>
          <Text className="mb-6 text-center text-sm text-muted-foreground">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Button onPress={() => this.setState({ hasError: false, error: null })}>
            <Text>Try Again</Text>
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}
