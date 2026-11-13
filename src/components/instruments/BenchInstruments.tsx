import React from 'react';
import { Multimeter } from './Multimeter';
import { Oscilloscope } from './Oscilloscope';
import { LogicAnalyzer } from './LogicAnalyzer';

export const BenchInstruments: React.FC = () => {
  return (
    <>
      <Multimeter />
      <Oscilloscope />
      <LogicAnalyzer />
    </>
  );
};
