import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
          <Text className="text-xl font-bold text-apple-ink">Something went wrong</Text>
          <Text className="mt-2 text-center text-apple-secondary">
            {this.state.error.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            className="mt-6 rounded-xl bg-accent px-5 py-3 active:opacity-90"
          >
            <Text className="font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
