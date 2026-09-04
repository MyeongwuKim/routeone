import "./src/instrument";
import { registerRootComponent } from "expo";
import * as Sentry from "@sentry/react-native";
import App from "./src/App";

registerRootComponent(Sentry.wrap(App));
