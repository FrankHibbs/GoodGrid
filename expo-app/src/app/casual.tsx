import { Redirect } from 'expo-router';

export default function CasualScreen() {
  return <Redirect href={{ pathname: '/puzzle', params: { mode: 'casual', size: '3', difficulty: 'easy' } }} />;
}
